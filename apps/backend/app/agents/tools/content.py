"""Instagram content drafts and scheduling (Content agent)."""
from __future__ import annotations

from typing import Any

from ..core.store import CONTENT, clean, now_iso, uid
from ..core.tools import ToolContext, ToolError, tool

CONTENT_TYPES = ["post", "carousel", "reel", "story"]
CONTENT_STATUSES = ["draft", "scheduled", "published", "archived"]


@tool(
    "list_content",
    "List content items (posts, reels, stories) by status, newest first. Check this to avoid repeating recent posts.",
    {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": CONTENT_STATUSES},
            "product_slug": {"type": "string"},
            "limit": {"type": "integer", "default": 20},
        },
    },
    label="List content",
)
async def list_content(ctx: ToolContext, status: str | None = None, product_slug: str | None = None, limit: int = 20) -> dict:
    q: dict[str, Any] = {}
    if status:
        q["status"] = status
    if product_slug:
        q["product_slugs"] = product_slug
    docs = await ctx.db[CONTENT].find(q).sort("created_at", -1).limit(min(int(limit or 20), 100)).to_list(100)
    return {"content": clean(docs)}


@tool(
    "create_content_draft",
    "Save an Instagram content idea as a draft: caption, hashtags, a visual brief for the photo/reel, and a suggested slot.",
    {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": CONTENT_TYPES},
            "title": {"type": "string", "description": "internal working title"},
            "product_slugs": {"type": "array", "items": {"type": "string"}},
            "caption": {"type": "string"},
            "hashtags": {"type": "array", "items": {"type": "string"}},
            "visual_brief": {"type": "string", "description": "what to shoot/render: setting, props, angles, text overlays"},
            "reel_script": {"type": "string", "description": "for reels: shot list with timings and on-screen text"},
            "suggested_slot": {"type": "string", "description": "ISO date-time or e.g. 'Wed 19:00'"},
            "campaign": {"type": "string"},
        },
        "required": ["type", "title", "caption", "visual_brief"],
    },
    risk="draft",
    label="Create content draft",
)
async def create_content_draft(ctx: ToolContext, type: str, title: str, caption: str, visual_brief: str,
                               product_slugs: list[str] | None = None, hashtags: list[str] | None = None,
                               reel_script: str | None = None, suggested_slot: str | None = None,
                               campaign: str | None = None) -> dict:
    doc = {
        "_id": uid("cnt"), "type": type, "title": title, "caption": caption,
        "hashtags": [h if h.startswith("#") else f"#{h}" for h in (hashtags or [])],
        "visual_brief": visual_brief, "reel_script": reel_script, "product_slugs": product_slugs or [],
        "suggested_slot": suggested_slot, "scheduled_for": None, "campaign": campaign, "status": "draft",
        "asset_ids": [], "metrics": {}, "created_by": ctx.agent, "run_id": ctx.run_id, "created_at": now_iso(),
    }
    await ctx.db[CONTENT].insert_one(doc)
    return {"content_id": doc["_id"], "status": "draft"}


@tool(
    "update_content_draft",
    "Edit a content draft's caption, hashtags, brief, script or suggested slot.",
    {
        "type": "object",
        "properties": {
            "content_id": {"type": "string"}, "caption": {"type": "string"},
            "hashtags": {"type": "array", "items": {"type": "string"}}, "visual_brief": {"type": "string"},
            "reel_script": {"type": "string"}, "suggested_slot": {"type": "string"}, "title": {"type": "string"},
        },
        "required": ["content_id"],
    },
    risk="draft",
    label="Update content draft",
)
async def update_content_draft(ctx: ToolContext, content_id: str, **fields: Any) -> dict:
    c = await ctx.db[CONTENT].find_one({"_id": content_id})
    if not c:
        raise ToolError("Content not found")
    if c.get("status") != "draft":
        raise ToolError("Only drafts can be edited")
    upd = {k: v for k, v in fields.items() if v is not None}
    upd["updated_at"] = now_iso()
    await ctx.db[CONTENT].update_one({"_id": content_id}, {"$set": upd})
    return {"content_id": content_id, "updated": sorted(upd.keys())}


async def _validate_schedule(ctx: ToolContext, content_id: str, scheduled_for: str, **_: Any) -> None:
    c = await ctx.db[CONTENT].find_one({"_id": content_id})
    if not c:
        raise ToolError("Content not found")
    if c.get("status") != "draft":
        raise ToolError(f"Content is already {c.get('status')}")
    if not scheduled_for:
        raise ToolError("scheduled_for is required")


@tool(
    "schedule_post",
    "Approve a content draft for publishing at a time. Phase 1: it becomes 'scheduled' in the content calendar "
    "(publishing to Instagram is manual until the Instagram integration is connected).",
    {
        "type": "object",
        "properties": {"content_id": {"type": "string"}, "scheduled_for": {"type": "string", "description": "ISO date-time, local IST"}},
        "required": ["content_id", "scheduled_for"],
    },
    risk="action",
    label="Schedule Instagram post",
    summarize=lambda a: f"Schedule content {a.get('content_id')} for {a.get('scheduled_for')}",
    validate=_validate_schedule,
)
async def schedule_post(ctx: ToolContext, content_id: str, scheduled_for: str) -> dict:
    await _validate_schedule(ctx, content_id, scheduled_for)
    await ctx.db[CONTENT].update_one(
        {"_id": content_id},
        {"$set": {"status": "scheduled", "scheduled_for": scheduled_for, "approved_by": ctx.actor, "updated_at": now_iso()}},
    )
    return {"content_id": content_id, "status": "scheduled", "scheduled_for": scheduled_for}
