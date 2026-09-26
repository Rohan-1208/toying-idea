"""Workflows: trigger (event | schedule | manual) -> agent + instruction."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import get_settings
from .store import EVENTS, RUNS, WORKFLOWS, clean, iso, now_iso, uid, utcnow
from .tools import ToolError

log = logging.getLogger("agent_os")

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DEFAULT_WORKFLOWS: list[dict] = [
    {
        "key": "new-order-intake",
        "name": "New order intake",
        "description": "Every website order: check stock, draft a confirmation, propose moving it into production.",
        "agent": "order_customer",
        "trigger": {"type": "event", "event": "order.created"},
        "instruction": (
            "A new website order was just placed. Look it up, check stock for every item, and look up the customer's history. "
            "Draft a warm order confirmation for the customer (email channel) that sets expectations on lead time. "
            "If every item can be made, propose moving the order to 'In production'. If something is out of stock or unclear, "
            "do not change the status; explain the problem in your summary."
        ),
        "enabled": True,
    },
    {
        "key": "custom-request-triage",
        "name": "Gifting & PYOT request triage",
        "description": "Qualify each customized gifting / print-your-own-toy request and draft a reply or quote.",
        "agent": "order_customer",
        "trigger": {"type": "event", "event": "request.created"},
        "instruction": (
            "A new custom request (gifting or PYOT) was submitted. Read it, identify what is missing to quote it "
            "(quantity, size, material, deadline, files), and draft a friendly reply that either asks for the missing details "
            "or gives an indicative price range using the pricing calculator. Propose moving the request to 'In review'."
        ),
        "enabled": True,
    },
    {
        "key": "daily-brief",
        "name": "Daily business brief",
        "description": "8 AM summary of yesterday: orders, revenue, requests, low stock, what needs attention.",
        "agent": "intelligence",
        "trigger": {"type": "schedule", "every": "daily", "at": "08:00"},
        "instruction": (
            "Write today's business brief covering the last 24 hours: orders and revenue, order pipeline by status, "
            "new custom requests, low-stock SKUs, and the 3 most important things for the owner to do today. Save it as an insight."
        ),
        "enabled": True,
    },
    {
        "key": "stale-order-check",
        "name": "Stuck order check",
        "description": "Daily check for orders sitting too long in one status and customers waiting on a reply.",
        "agent": "order_customer",
        "trigger": {"type": "schedule", "every": "daily", "at": "10:30"},
        "instruction": (
            "Find orders that have been in 'Placed' for more than 2 days or 'In production' for more than 6 days, "
            "and custom requests with no reply for more than 1 day. For each, draft a short proactive update to the customer. "
            "Summarise the list for the owner."
        ),
        "enabled": True,
    },
    {
        "key": "weekly-content-plan",
        "name": "Weekly content plan",
        "description": "Monday 9 AM: plan the week's Instagram posts and reels from new and best-selling products.",
        "agent": "content",
        "trigger": {"type": "schedule", "every": "weekly", "weekday": 0, "at": "09:00"},
        "instruction": (
            "Plan this week's Instagram content: 4 posts/carousels and 2 reels. Use best sellers from the last 30 days and any "
            "recently launched products. For each, create a content draft with caption, hashtags, a visual brief and a suggested "
            "day/time. Keep captions short and playful."
        ),
        "enabled": True,
    },
    {
        "key": "weekly-opportunities",
        "name": "Weekly product opportunities",
        "description": "Friday 6 PM: which products to promote, restock, retire, and which new ideas customers are asking for.",
        "agent": "intelligence",
        "trigger": {"type": "schedule", "every": "weekly", "weekday": 4, "at": "18:00"},
        "instruction": (
            "Analyse the last 30 days of sales, custom requests, inventory and content. Recommend: products to promote, "
            "products to restock, products to retire, and up to 3 new product ideas backed by customer requests. "
            "Save it as an insight with prioritised recommendations."
        ),
        "enabled": True,
    },
    {
        "key": "launch-content-followup",
        "name": "Launch → content follow-up",
        "description": "When a product is published, draft its launch posts.",
        "agent": "content",
        "trigger": {"type": "event", "event": "product.published"},
        "instruction": "A product just went live. Draft a launch carousel post and a short reel script for it.",
        "enabled": False,
    },
]


# ------------------------------------------------------------------ schedule
def compute_next_run(trigger: dict, after: datetime, offset_minutes: int = 330) -> datetime | None:
    if (trigger or {}).get("type") != "schedule":
        return None
    every = trigger.get("every", "daily")
    if every == "interval":
        minutes = max(5, int(trigger.get("interval_minutes") or 60))
        return after + timedelta(minutes=minutes)
    hh, mm = 8, 0
    try:
        hh, mm = [int(x) for x in str(trigger.get("at") or "08:00").split(":")[:2]]
    except Exception:
        pass
    offset = timedelta(minutes=offset_minutes)
    local_after = after + offset
    if every == "hourly":
        cand = local_after.replace(minute=mm, second=0, microsecond=0)
        if cand <= local_after:
            cand += timedelta(hours=1)
        return cand - offset
    cand = local_after.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if every == "weekly":
        wd = int(trigger.get("weekday") or 0)
        cand += timedelta(days=(wd - cand.weekday()) % 7)
        if cand <= local_after:
            cand += timedelta(days=7)
    else:  # daily
        if cand <= local_after:
            cand += timedelta(days=1)
    return cand - offset


def describe_trigger(trigger: dict) -> str:
    t = trigger or {}
    if t.get("type") == "event":
        return f"On {t.get('event')}"
    if t.get("type") == "schedule":
        every = t.get("every", "daily")
        if every == "interval":
            return f"Every {t.get('interval_minutes')} min"
        if every == "hourly":
            return f"Hourly at :{str(t.get('at', '00:00')).split(':')[-1]}"
        if every == "weekly":
            return f"{WEEKDAYS[int(t.get('weekday') or 0)]}s at {t.get('at')}"
        return f"Daily at {t.get('at')}"
    return "Manual only"


def validate_workflow(data: dict) -> dict:
    from ..definitions.registry import AGENT_DEFS
    from .events import EVENT_TYPES

    if data.get("agent") not in AGENT_DEFS:
        raise ToolError("Unknown agent")
    if not str(data.get("name") or "").strip():
        raise ToolError("Name is required")
    if not str(data.get("instruction") or "").strip():
        raise ToolError("Instruction is required")
    trig = data.get("trigger") or {"type": "manual"}
    ttype = trig.get("type")
    if ttype == "event":
        if trig.get("event") not in EVENT_TYPES:
            raise ToolError("Unknown event type")
    elif ttype == "schedule":
        if trig.get("every") not in ("daily", "weekly", "hourly", "interval"):
            raise ToolError("Schedule 'every' must be daily, weekly, hourly or interval")
        if trig.get("every") == "interval" and int(trig.get("interval_minutes") or 0) < 5:
            raise ToolError("Interval must be at least 5 minutes")
    elif ttype != "manual":
        raise ToolError("Trigger type must be event, schedule or manual")
    data["trigger"] = trig
    return data


async def save_workflow(db, data: dict, workflow_id: str | None = None) -> dict:
    settings = await get_settings(db)
    fields = {k: data[k] for k in ("name", "description", "agent", "instruction", "trigger", "enabled") if k in data}
    if workflow_id:
        existing = await db[WORKFLOWS].find_one({"_id": workflow_id})
        if not existing:
            raise ToolError("Workflow not found")
        merged = {**existing, **fields}
        validate_workflow(merged)
        fields["trigger"] = merged["trigger"]
    else:
        fields.setdefault("enabled", True)
        fields.setdefault("description", "")
        validate_workflow(fields)
    nxt = compute_next_run(fields.get("trigger") or {}, utcnow(), int(settings["utc_offset_minutes"]))
    fields["next_run_at"] = iso(nxt) if nxt else None
    fields["updated_at"] = now_iso()
    if workflow_id:
        await db[WORKFLOWS].update_one({"_id": workflow_id}, {"$set": fields})
        return clean(await db[WORKFLOWS].find_one({"_id": workflow_id}))
    doc = {"_id": uid("wf"), "created_at": now_iso(), "run_count": 0, "last_run_at": None, "last_run_id": None, **fields}
    await db[WORKFLOWS].insert_one(doc)
    return clean(doc)


async def seed_workflows(db) -> None:
    for wf in DEFAULT_WORKFLOWS:
        if await db[WORKFLOWS].find_one({"key": wf["key"]}):
            continue
        doc = await save_workflow(db, {k: v for k, v in wf.items() if k != "key"})
        await db[WORKFLOWS].update_one({"_id": doc["id"]}, {"$set": {"key": wf["key"]}})


# ------------------------------------------------------------------ dispatch
def _get_path(obj: Any, path: str) -> Any:
    for part in path.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


def _matches_filter(payload: dict, flt: dict | None) -> bool:
    for k, v in (flt or {}).items():
        if _get_path(payload, k) != v:
            return False
    return True


def build_task(wf: dict, payload: dict | None = None) -> str:
    task = wf["instruction"].strip()
    if payload:
        task += "\n\nEvent data:\n```json\n" + json.dumps(clean(payload), ensure_ascii=False, indent=2, default=str)[:6000] + "\n```"
    return task


async def start_workflow_run(db, runtime, wf: dict, *, payload: dict | None = None, trigger: dict | None = None) -> str:
    run_id = await runtime.create_run(
        wf["agent"],
        build_task(wf, payload),
        trigger=trigger or {"type": "workflow", "workflow_id": wf["_id"], "workflow": wf["name"]},
    )
    await db[WORKFLOWS].update_one(
        {"_id": wf["_id"]},
        {"$set": {"last_run_at": now_iso(), "last_run_id": run_id}, "$inc": {"run_count": 1}},
    )
    return run_id


async def process_events(db, runtime, limit: int = 50) -> list[str]:
    """Claim pending events and start runs for matching enabled workflows."""
    started: list[str] = []
    for _ in range(limit):
        evt = await db[EVENTS].find_one_and_update(
            {"status": "pending"}, {"$set": {"status": "processing", "processing_at": now_iso()}}, return_document=True
        )
        if not evt:
            break
        run_ids: list[str] = []
        try:
            wfs = await db[WORKFLOWS].find({"enabled": True, "trigger.type": "event", "trigger.event": evt["type"]}).to_list(100)
            for wf in wfs:
                if not _matches_filter(evt.get("payload") or {}, wf["trigger"].get("filter")):
                    continue
                rid = await start_workflow_run(
                    db,
                    runtime,
                    wf,
                    payload={"event": evt["type"], **(evt.get("payload") or {})},
                    trigger={"type": "event", "event": evt["type"], "event_id": evt["_id"], "workflow_id": wf["_id"], "workflow": wf["name"]},
                )
                run_ids.append(rid)
            await db[EVENTS].update_one({"_id": evt["_id"]}, {"$set": {"status": "processed", "run_ids": run_ids}})
        except Exception as e:
            log.exception("event dispatch failed")
            await db[EVENTS].update_one({"_id": evt["_id"]}, {"$set": {"status": "failed", "error": str(e)}})
        started.extend(run_ids)
    return started


async def run_due_schedules(db, runtime) -> list[str]:
    settings = await get_settings(db)
    offset = int(settings["utc_offset_minutes"])
    now = utcnow()
    started: list[str] = []
    due = await db[WORKFLOWS].find(
        {"enabled": True, "trigger.type": "schedule", "next_run_at": {"$lte": iso(now)}}
    ).to_list(100)
    for wf in due:
        nxt = compute_next_run(wf["trigger"], now, offset)
        # Atomic claim: only the worker that moves next_run_at forward starts the run.
        claimed = await db[WORKFLOWS].find_one_and_update(
            {"_id": wf["_id"], "next_run_at": wf["next_run_at"]},
            {"$set": {"next_run_at": iso(nxt) if nxt else None}},
            return_document=True,
        )
        if not claimed:
            continue
        started.append(
            await start_workflow_run(
                db, runtime, claimed, trigger={"type": "schedule", "workflow_id": wf["_id"], "workflow": wf["name"]}
            )
        )
    return started


async def recover_stuck_runs(db, runtime) -> list[str]:
    """Re-kick queued runs that were never started (e.g. after a restart); fail long-running ones."""
    now = utcnow()
    stale_queued = await db[RUNS].find(
        {"status": "queued", "created_at": {"$lte": iso(now - timedelta(seconds=90))}}
    ).to_list(20)
    await db[RUNS].update_many(
        {"status": "running", "started_at": {"$lte": iso(now - timedelta(minutes=20))}},
        {"$set": {"status": "failed", "error": "Timed out (worker restarted or run hung)", "finished_at": now_iso()}},
    )
    return [r["_id"] for r in stale_queued]
