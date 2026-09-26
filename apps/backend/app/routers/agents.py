"""Admin API for the Agent OS dashboard (/admin/agents)."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..agents.core.actions import approve_action, reject_action, retry_action
from ..agents.core.config import get_agent_config, get_settings, update_agent_config, update_settings
from ..agents.core.events import EVENT_TYPES, emit_event
from ..agents.core.llm import AVAILABLE_MODELS
from ..agents.core.runtime import AgentRuntime
from ..agents.core.store import (
    ACTIONS, ASSETS, CONTENT, CUSTOMERS, EVENTS, INSIGHTS, INVENTORY, MESSAGES, ORDERS, RUNS, WORKFLOWS,
    clean, now_iso, start_of_utc_day_iso,
)
from ..agents.core.tools import ToolError, registry
from ..agents.core.workflows import describe_trigger, save_workflow, seed_workflows, start_workflow_run
from ..agents.core.worker import tick
from ..agents.definitions.registry import AGENT_DEFS
from ..agents.integrations.channels import channel_status
from ..db import get_db
from ..deps import require_admin

router = APIRouter(prefix="/admin", tags=["agents"])


def _who(admin: dict) -> str:
    return f"human:{admin.get('email') or admin.get('id')}"


def _bad(e: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ------------------------------------------------------------------ overview
@router.get("/agent-os/overview")
async def overview(admin=Depends(require_admin)):
    db = await get_db()
    today = start_of_utc_day_iso()
    settings = await get_settings(db)
    runs_today = await db[RUNS].find({"created_at": {"$gte": today}}, {"steps": 0}).to_list(2000)
    per_agent: dict[str, dict] = {k: {"runs_today": 0, "failed_today": 0, "last_run_at": None, "last_status": None} for k in AGENT_DEFS}
    cost = 0.0
    for r in runs_today:
        a = per_agent.setdefault(r["agent"], {"runs_today": 0, "failed_today": 0, "last_run_at": None, "last_status": None})
        a["runs_today"] += 1
        if r.get("status") == "failed":
            a["failed_today"] += 1
        cost += float((r.get("usage") or {}).get("cost_usd") or 0)
    for k in AGENT_DEFS:
        last = await db[RUNS].find({"agent": k}, {"steps": 0}).sort("created_at", -1).limit(1).to_list(1)
        if last:
            per_agent[k]["last_run_at"] = last[0].get("created_at")
            per_agent[k]["last_status"] = last[0].get("status")
    recent = await db[RUNS].find({}, {"steps": 0}).sort("created_at", -1).limit(12).to_list(12)
    agents = []
    for k, d in AGENT_DEFS.items():
        cfg = await get_agent_config(db, k)
        agents.append({**cfg, "icon": d.icon, **per_agent.get(k, {})})
    return {
        "paused": settings["paused"],
        "pending_actions": await db[ACTIONS].count_documents({"status": "pending"}),
        "runs_today": len(runs_today),
        "failed_today": sum(1 for r in runs_today if r.get("status") == "failed"),
        "running": await db[RUNS].count_documents({"status": {"$in": ["queued", "running"]}}),
        "cost_today_usd": round(cost, 4),
        "daily_run_budget": settings["daily_run_budget"],
        "open_orders": await db[ORDERS].count_documents({"status": {"$in": ["Placed", "In production", "Quality check"]}}),
        "draft_messages": await db[MESSAGES].count_documents({"status": {"$in": ["draft", "ready_to_send"]}}),
        "api_key_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "worker_enabled": os.getenv("AGENT_WORKER", "1") != "0",
        "channels": channel_status(),
        "agents": agents,
        "recent_runs": clean(recent),
    }


# ------------------------------------------------------------------ settings
class SettingsPatch(BaseModel):
    paused: bool | None = None
    daily_run_budget: int | None = Field(default=None, ge=1, le=5000)
    max_steps: int | None = Field(default=None, ge=2, le=40)
    low_stock_threshold: int | None = Field(default=None, ge=0)
    business: dict | None = None
    pricing: dict | None = None


@router.get("/agent-os/settings")
async def get_os_settings(admin=Depends(require_admin)):
    return await get_settings(await get_db())


@router.patch("/agent-os/settings")
async def patch_os_settings(payload: SettingsPatch, admin=Depends(require_admin)):
    db = await get_db()
    return await update_settings(db, {k: v for k, v in payload.model_dump().items() if v is not None})


@router.post("/agent-os/tick")
async def manual_tick(admin=Depends(require_admin)):
    """Process pending events and due schedules now (also runs automatically every ~20s)."""
    return await tick(await get_db())


# ------------------------------------------------------------------ agents
@router.get("/agent-os/agents")
async def list_agents(admin=Depends(require_admin)):
    db = await get_db()
    out = []
    for k, d in AGENT_DEFS.items():
        cfg = await get_agent_config(db, k)
        tools = [registry.get(t) for t in d.tools]
        out.append({
            **cfg,
            "icon": d.icon,
            "default_model": d.default_model,
            "system_prompt": d.system_prompt.strip(),
            "tool_details": [{"name": t.name, "label": t.label or t.name, "risk": t.risk, "description": t.description} for t in tools if t],
        })
    return {"agents": out, "models": AVAILABLE_MODELS}


class AgentPatch(BaseModel):
    enabled: bool | None = None
    model: str | None = None
    auto_approve_tools: list[str] | None = None
    instructions: str | None = Field(default=None, max_length=8000)


@router.patch("/agent-os/agents/{key}")
async def patch_agent(key: str, payload: AgentPatch, admin=Depends(require_admin)):
    if key not in AGENT_DEFS:
        raise HTTPException(status_code=404, detail="Unknown agent")
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "model" in data and data["model"] not in {m["id"] for m in AVAILABLE_MODELS}:
        raise HTTPException(status_code=400, detail="Unknown model")
    if "auto_approve_tools" in data:
        allowed = {t for t in AGENT_DEFS[key].tools if (registry.get(t) and registry.get(t).risk == "action")}
        bad = set(data["auto_approve_tools"]) - allowed
        if bad:
            raise HTTPException(status_code=400, detail=f"Not action tools of this agent: {sorted(bad)}")
    return await update_agent_config(await get_db(), key, data)


class RunInput(BaseModel):
    task: str = Field(min_length=3, max_length=20000)
    attachments: list[dict] = []


@router.post("/agent-os/agents/{key}/run", status_code=status.HTTP_202_ACCEPTED)
async def run_agent(key: str, payload: RunInput, admin=Depends(require_admin)):
    db = await get_db()
    rt = AgentRuntime(db)
    try:
        run_id = await rt.create_run(key, payload.task, trigger={"type": "manual", "by": _who(admin)}, attachments=payload.attachments)
    except ToolError as e:
        raise _bad(e)
    rt.kick(run_id)
    return {"run_id": run_id}


# ------------------------------------------------------------------ runs
@router.get("/agent-os/runs")
async def list_runs(agent: str | None = None, status_filter: str | None = None, limit: int = 50, admin=Depends(require_admin)):
    db = await get_db()
    q: dict[str, Any] = {"depth": 0} if not agent else {}
    if agent:
        q["agent"] = agent
    if status_filter:
        q["status"] = status_filter
    docs = await db[RUNS].find(q, {"steps": 0}).sort("created_at", -1).limit(min(limit, 200)).to_list(200)
    return {"runs": clean(docs)}


@router.get("/agent-os/runs/{run_id}")
async def get_run(run_id: str, admin=Depends(require_admin)):
    db = await get_db()
    run = await db[RUNS].find_one({"_id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    actions = await db[ACTIONS].find({"run_id": run_id}).to_list(100)
    children = await db[RUNS].find({"parent_run_id": run_id}, {"steps": 0}).to_list(50)
    return {"run": clean(run), "actions": clean(actions), "children": clean(children)}


# ------------------------------------------------------------------ approvals
async def _preview(db, a: dict) -> dict | None:
    args = a.get("args") or {}
    if a["tool"] == "send_customer_message":
        m = await db[MESSAGES].find_one({"_id": args.get("message_id")})
        return {"kind": "message", "message": clean(m)} if m else None
    if a["tool"] == "update_order_status":
        o = await db[ORDERS].find_one({"number": args.get("order_number")})
        if o:
            c = o.get("customer") or {}
            return {"kind": "order", "number": o.get("number"), "current_status": o.get("status"), "customer": c.get("name"),
                    "items": [f"{it.get('quantity')} × {it.get('name') or it.get('productSlug')}" for it in o.get("items") or []]}
    if a["tool"] == "schedule_post":
        c = await db[CONTENT].find_one({"_id": args.get("content_id")})
        return {"kind": "content", "content": clean(c)} if c else None
    if a["tool"] in ("publish_product", "set_variant_price"):
        from ..agents.tools.catalog import product_view

        p = await db["products"].find_one({"slug": args.get("slug")})
        return {"kind": "product", "product": product_view(p, full=True)} if p else None
    return None


@router.get("/agent-os/actions")
async def list_actions(status_filter: str = "pending", limit: int = 100, admin=Depends(require_admin)):
    db = await get_db()
    q = {} if status_filter == "all" else {"status": status_filter}
    docs = await db[ACTIONS].find(q).sort("created_at", -1).limit(min(limit, 300)).to_list(300)
    out = []
    for a in docs:
        item = clean(a)
        item["agent_name"] = AGENT_DEFS[a["agent"]].name if a.get("agent") in AGENT_DEFS else a.get("agent")
        item["preview"] = await _preview(db, a) if a.get("status") == "pending" else None
        out.append(item)
    return {"actions": out}


class Decision(BaseModel):
    note: str | None = None
    always_allow: bool = False
    args: dict | None = None
    message_body: str | None = None  # edit a drafted customer message before sending


@router.post("/agent-os/actions/{action_id}/approve")
async def approve(action_id: str, payload: Decision, admin=Depends(require_admin)):
    db = await get_db()
    try:
        if payload.message_body is not None:
            a = await db[ACTIONS].find_one({"_id": action_id})
            if a and a["tool"] == "send_customer_message":
                await db[MESSAGES].update_one(
                    {"_id": (a.get("args") or {}).get("message_id"), "status": "draft"},
                    {"$set": {"body": payload.message_body, "edited_by": _who(admin), "updated_at": now_iso()}},
                )
        return await approve_action(db, action_id, by=_who(admin), note=payload.note, always_allow=payload.always_allow, args=payload.args)
    except ToolError as e:
        raise _bad(e)


@router.post("/agent-os/actions/{action_id}/reject")
async def reject(action_id: str, payload: Decision, admin=Depends(require_admin)):
    try:
        return await reject_action(await get_db(), action_id, by=_who(admin), note=payload.note)
    except ToolError as e:
        raise _bad(e)


@router.post("/agent-os/actions/{action_id}/retry")
async def retry(action_id: str, admin=Depends(require_admin)):
    try:
        return await retry_action(await get_db(), action_id, by=_who(admin))
    except ToolError as e:
        raise _bad(e)


# ------------------------------------------------------------------ workflows
class WorkflowInput(BaseModel):
    name: str | None = None
    description: str | None = None
    agent: str | None = None
    instruction: str | None = None
    trigger: dict | None = None
    enabled: bool | None = None


@router.get("/agent-os/workflows")
async def list_workflows(admin=Depends(require_admin)):
    db = await get_db()
    await seed_workflows(db)
    docs = await db[WORKFLOWS].find({}).sort("created_at", 1).to_list(500)
    out = []
    for w in docs:
        item = clean(w)
        item["trigger_label"] = describe_trigger(w.get("trigger") or {})
        item["agent_name"] = AGENT_DEFS[w["agent"]].name if w.get("agent") in AGENT_DEFS else w.get("agent")
        out.append(item)
    return {
        "workflows": out,
        "event_types": [{"type": k, "label": v} for k, v in EVENT_TYPES.items()],
        "agents": [{"key": k, "name": d.name} for k, d in AGENT_DEFS.items()],
    }


@router.post("/agent-os/workflows", status_code=201)
async def create_workflow(payload: WorkflowInput, admin=Depends(require_admin)):
    try:
        return await save_workflow(await get_db(), {k: v for k, v in payload.model_dump().items() if v is not None})
    except ToolError as e:
        raise _bad(e)


@router.patch("/agent-os/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, payload: WorkflowInput, admin=Depends(require_admin)):
    try:
        return await save_workflow(await get_db(), {k: v for k, v in payload.model_dump().items() if v is not None}, workflow_id)
    except ToolError as e:
        raise _bad(e)


@router.delete("/agent-os/workflows/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: str, admin=Depends(require_admin)):
    db = await get_db()
    await db[WORKFLOWS].delete_one({"_id": workflow_id})
    return None


@router.post("/agent-os/workflows/{workflow_id}/run", status_code=202)
async def run_workflow_now(workflow_id: str, admin=Depends(require_admin)):
    db = await get_db()
    wf = await db[WORKFLOWS].find_one({"_id": workflow_id})
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    rt = AgentRuntime(db)
    run_id = await start_workflow_run(db, rt, wf, trigger={"type": "manual_workflow", "workflow_id": workflow_id, "workflow": wf["name"], "by": _who(admin)})
    rt.kick(run_id)
    return {"run_id": run_id}


# ------------------------------------------------------------------ data browser
DATA_KINDS = {
    "messages": (MESSAGES, "created_at"),
    "content": (CONTENT, "created_at"),
    "insights": (INSIGHTS, "created_at"),
    "assets": (ASSETS, "created_at"),
    "customers": (CUSTOMERS, "updated_at"),
    "inventory": (INVENTORY, "updated_at"),
    "events": (EVENTS, "created_at"),
}


@router.get("/agent-os/data/{kind}")
async def list_data(kind: str, status_filter: str | None = None, limit: int = 50, admin=Depends(require_admin)):
    if kind not in DATA_KINDS:
        raise HTTPException(status_code=404, detail="Unknown data kind")
    coll, sort_key = DATA_KINDS[kind]
    q = {"status": status_filter} if status_filter else {}
    docs = await (await get_db())[coll].find(q).sort(sort_key, -1).limit(min(limit, 300)).to_list(300)
    return {"items": clean(docs)}


EDITABLE = {
    "messages": ({"subject", "body"}, {"draft"}),
    "content": ({"title", "caption", "hashtags", "visual_brief", "reel_script", "suggested_slot"}, {"draft"}),
}


@router.patch("/agent-os/data/{kind}/{item_id}")
async def edit_data(kind: str, item_id: str, payload: dict, admin=Depends(require_admin)):
    if kind not in EDITABLE:
        raise HTTPException(status_code=400, detail="Not editable")
    fields, statuses = EDITABLE[kind]
    coll = DATA_KINDS[kind][0]
    upd = {k: v for k, v in payload.items() if k in fields}
    if kind == "messages" and payload.get("status") == "sent":
        # owner marks a manually-sent message as sent
        res = await (await get_db())[coll].update_one({"_id": item_id, "status": "ready_to_send"}, {"$set": {"status": "sent", "sent_at": now_iso(), "sent_by": _who(admin)}})
        return {"updated": res.modified_count}
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    upd["updated_at"] = now_iso()
    upd["edited_by"] = _who(admin)
    res = await (await get_db())[coll].update_one({"_id": item_id, "status": {"$in": list(statuses)}}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=409, detail="Item not found or no longer editable")
    return {"updated": 1}


# ------------------------------------------------------------------ test hook
class EmitInput(BaseModel):
    type: str
    payload: dict = {}


@router.post("/agent-os/events", status_code=201)
async def emit(payload: EmitInput, admin=Depends(require_admin)):
    """Manually emit an event (for testing workflows from the dashboard)."""
    if payload.type not in EVENT_TYPES:
        raise HTTPException(status_code=400, detail="Unknown event type")
    return {"event_id": await emit_event(await get_db(), payload.type, payload.payload, source=_who(admin))}
