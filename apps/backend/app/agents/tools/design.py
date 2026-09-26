"""3D design assets: briefs, Blender scripts, render/export jobs (3D Design agent).

Phase 1 stores briefs and Blender Python scripts as assets. Phase 4 adds a local
Blender worker that picks up `queued` render jobs, runs
`blender --background --python <script>` and uploads the renders/STL back.
"""
from __future__ import annotations

import ast
from typing import Any

from ..core.store import ASSETS, clean, now_iso, uid
from ..core.tools import ToolContext, ToolError, tool

ASSET_TYPES = ["design_brief", "blender_script", "render", "stl", "3mf", "image", "other"]


@tool(
    "list_assets",
    "List design and media assets (briefs, Blender scripts, renders, STL/3MF files, images).",
    {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": ASSET_TYPES},
            "product_slug": {"type": "string"},
            "limit": {"type": "integer", "default": 20},
        },
    },
    label="List assets",
)
async def list_assets(ctx: ToolContext, type: str | None = None, product_slug: str | None = None, limit: int = 20) -> dict:
    q: dict[str, Any] = {}
    if type:
        q["type"] = type
    if product_slug:
        q["product_slug"] = product_slug
    docs = await ctx.db[ASSETS].find(q, {"content": 0}).sort("created_at", -1).limit(min(int(limit or 20), 100)).to_list(100)
    return {"assets": clean(docs)}


@tool(
    "get_asset",
    "Get one asset including its content (e.g. the full Blender script or brief).",
    {"type": "object", "properties": {"asset_id": {"type": "string"}}, "required": ["asset_id"]},
    label="Get asset",
)
async def get_asset(ctx: ToolContext, asset_id: str) -> dict:
    a = await ctx.db[ASSETS].find_one({"_id": asset_id})
    if not a:
        raise ToolError("Asset not found")
    return clean(a)


@tool(
    "create_design_brief",
    "Save a printable-toy design brief: concept, target size, parts/articulation, print orientation, supports, tolerances, colours.",
    {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "concept": {"type": "string"},
            "dimensions_mm": {"type": "object", "properties": {"x": {"type": "number"}, "y": {"type": "number"}, "z": {"type": "number"}}},
            "parts": {"type": "array", "items": {"type": "string"}},
            "printability": {"type": "string", "description": "orientation, supports, min wall 1.2mm, clearances 0.3mm, overhangs"},
            "materials_colours": {"type": "string"},
            "estimated_grams": {"type": "number"},
            "estimated_print_hours": {"type": "number"},
            "request_id": {"type": "string", "description": "PYOT/gifting request this is for"},
            "product_slug": {"type": "string"},
        },
        "required": ["title", "concept", "printability"],
    },
    risk="draft",
    label="Create design brief",
)
async def create_design_brief(ctx: ToolContext, title: str, concept: str, printability: str, **kw: Any) -> dict:
    doc = {
        "_id": uid("ast"), "type": "design_brief", "title": title, "status": "draft",
        "content": {"concept": concept, "printability": printability, **{k: v for k, v in kw.items() if k not in ("request_id", "product_slug")}},
        "request_id": kw.get("request_id"), "product_slug": kw.get("product_slug"),
        "created_by": ctx.agent, "run_id": ctx.run_id, "created_at": now_iso(),
    }
    await ctx.db[ASSETS].insert_one(doc)
    return {"asset_id": doc["_id"]}


@tool(
    "save_blender_script",
    "Save a Blender (bpy) Python script that builds the model parametrically and exports STL/3MF. "
    "The script must be self-contained, use only bpy/bmesh/mathutils, read OUTPUT_DIR from the environment, and "
    "export to os.path.join(OUTPUT_DIR, '<name>.stl'). It is syntax-checked before saving.",
    {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "script": {"type": "string"},
            "parameters": {"type": "object", "description": "tunable parameters and their defaults"},
            "brief_id": {"type": "string"},
            "product_slug": {"type": "string"},
        },
        "required": ["title", "script"],
    },
    risk="draft",
    label="Save Blender script",
)
async def save_blender_script(ctx: ToolContext, title: str, script: str, parameters: dict | None = None,
                              brief_id: str | None = None, product_slug: str | None = None) -> dict:
    try:
        ast.parse(script)
    except SyntaxError as e:
        raise ToolError(f"Script has a syntax error on line {e.lineno}: {e.msg}")
    banned = [b for b in ("subprocess", "shutil.rmtree", "os.remove", "os.system", "requests", "urllib", "socket") if b in script]
    if banned:
        raise ToolError(f"Script uses disallowed modules/calls: {banned}")
    doc = {
        "_id": uid("ast"), "type": "blender_script", "title": title, "status": "draft",
        "content": {"script": script, "parameters": parameters or {}}, "brief_id": brief_id, "product_slug": product_slug,
        "created_by": ctx.agent, "run_id": ctx.run_id, "created_at": now_iso(),
    }
    await ctx.db[ASSETS].insert_one(doc)
    return {"asset_id": doc["_id"], "lines": script.count("\n") + 1}


async def _validate_render(ctx: ToolContext, asset_id: str, **_: Any) -> None:
    a = await ctx.db[ASSETS].find_one({"_id": asset_id})
    if not a or a.get("type") != "blender_script":
        raise ToolError("asset_id must be a saved blender_script")


@tool(
    "queue_render_job",
    "Queue a saved Blender script to run on the Blender worker (renders + STL/3MF export).",
    {
        "type": "object",
        "properties": {
            "asset_id": {"type": "string"},
            "outputs": {"type": "array", "items": {"type": "string", "enum": ["render", "stl", "3mf"]}},
        },
        "required": ["asset_id"],
    },
    risk="action",
    label="Run Blender job",
    summarize=lambda a: f"Run Blender script {a.get('asset_id')} → {', '.join(a.get('outputs') or ['render', 'stl'])}",
    validate=_validate_render,
)
async def queue_render_job(ctx: ToolContext, asset_id: str, outputs: list[str] | None = None) -> dict:
    await _validate_render(ctx, asset_id)
    await ctx.db[ASSETS].update_one(
        {"_id": asset_id},
        {"$set": {"job": {"status": "queued", "outputs": outputs or ["render", "stl"], "queued_at": now_iso(), "queued_by": ctx.actor}}},
    )
    return {"asset_id": asset_id, "job_status": "queued", "note": "Runs when the Blender worker is connected (Phase 4)."}
