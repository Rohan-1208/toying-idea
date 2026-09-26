"""Approval queue and executor for consequential (risk="action") tools."""
from __future__ import annotations

import traceback
from typing import Any

from .store import ACTIONS, AGENTS, RUNS, clean, now_iso, uid
from .tools import ToolContext, ToolError, registry


async def create_action(
    db,
    *,
    agent: str,
    tool_name: str,
    args: dict,
    reason: str,
    run_id: str | None,
) -> dict:
    t = registry.get(tool_name)
    doc = {
        "_id": uid("act"),
        "agent": agent,
        "tool": tool_name,
        "label": (t.label if t else tool_name) or tool_name,
        "summary": t.summary(args) if t else tool_name,
        "args": args,
        "reason": reason,
        "run_id": run_id,
        "status": "pending",  # pending | approved | executing | executed | failed | rejected
        "created_at": now_iso(),
        "decided_at": None,
        "decided_by": None,
        "note": None,
        "result": None,
        "error": None,
    }
    await db[ACTIONS].insert_one(doc)
    if run_id:
        await db[RUNS].update_one({"_id": run_id}, {"$push": {"action_ids": doc["_id"]}})
    return doc


async def execute_action(db, action_id: str, *, actor: str) -> dict:
    """Run an approved action exactly as proposed. Atomic claim prevents double execution."""
    claimed = await db[ACTIONS].find_one_and_update(
        {"_id": action_id, "status": "approved"},
        {"$set": {"status": "executing", "executing_at": now_iso()}},
        return_document=True,
    )
    if not claimed:
        doc = await db[ACTIONS].find_one({"_id": action_id})
        return clean(doc) if doc else {"error": "not found"}

    t = registry.get(claimed["tool"])
    update: dict[str, Any]
    if t is None:
        update = {"status": "failed", "error": f"Unknown tool {claimed['tool']}"}
    else:
        ctx = ToolContext(db=db, agent=claimed["agent"], run_id=claimed.get("run_id"), actor=actor)
        try:
            result = await t.handler(ctx, **(claimed.get("args") or {}))
            update = {"status": "executed", "result": clean(result), "executed_at": now_iso()}
        except ToolError as e:
            update = {"status": "failed", "error": str(e)}
        except Exception as e:  # pragma: no cover - defensive
            update = {"status": "failed", "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-2000:]}
    await db[ACTIONS].update_one({"_id": action_id}, {"$set": update})

    from .events import emit_event

    await emit_event(
        db,
        "action.executed" if update["status"] == "executed" else "action.failed",
        {"action_id": action_id, "tool": claimed["tool"], "agent": claimed["agent"], "args": claimed.get("args")},
        source="executor",
    )
    return clean(await db[ACTIONS].find_one({"_id": action_id}))


async def approve_action(db, action_id: str, *, by: str, note: str | None = None, always_allow: bool = False, args: dict | None = None) -> dict:
    """Approve (optionally with edited args) and execute immediately."""
    doc = await db[ACTIONS].find_one({"_id": action_id})
    if not doc:
        raise ToolError("Action not found")
    if doc["status"] != "pending":
        raise ToolError(f"Action is already {doc['status']}")
    patch: dict[str, Any] = {"status": "approved", "decided_at": now_iso(), "decided_by": by, "note": note}
    if args is not None:
        patch["original_args"] = doc.get("args")
        patch["args"] = args
        patch["edited"] = True
    res = await db[ACTIONS].find_one_and_update({"_id": action_id, "status": "pending"}, {"$set": patch}, return_document=True)
    if not res:
        raise ToolError("Action was decided by someone else")
    if always_allow:
        await db[AGENTS].update_one(
            {"_id": doc["agent"]}, {"$addToSet": {"auto_approve_tools": doc["tool"]}, "$set": {"updated_at": now_iso()}}, upsert=True
        )
    return await execute_action(db, action_id, actor=by)


async def reject_action(db, action_id: str, *, by: str, note: str | None = None) -> dict:
    res = await db[ACTIONS].find_one_and_update(
        {"_id": action_id, "status": "pending"},
        {"$set": {"status": "rejected", "decided_at": now_iso(), "decided_by": by, "note": note}},
        return_document=True,
    )
    if not res:
        raise ToolError("Action not found or not pending")
    return clean(res)


async def retry_action(db, action_id: str, *, by: str) -> dict:
    res = await db[ACTIONS].find_one_and_update(
        {"_id": action_id, "status": "failed"},
        {"$set": {"status": "approved", "retried_by": by, "error": None}},
        return_document=True,
    )
    if not res:
        raise ToolError("Only failed actions can be retried")
    return await execute_action(db, action_id, actor=by)
