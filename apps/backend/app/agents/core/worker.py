"""Background worker: dispatches events, fires schedules, recovers stuck runs.

Runs inside the API process (one asyncio task). All claims are atomic in MongoDB,
so running several replicas is safe.
"""
from __future__ import annotations

import asyncio
import logging
import os

from .runtime import AgentRuntime
from .workflows import process_events, recover_stuck_runs, run_due_schedules

log = logging.getLogger("agent_os")

_task: asyncio.Task | None = None


async def tick(db, runtime: AgentRuntime | None = None, *, execute_inline: bool = False) -> dict:
    runtime = runtime or AgentRuntime(db)
    from .config import get_settings

    settings = await get_settings(db)
    if settings.get("paused"):
        return {"paused": True, "started": []}
    started = []
    started += await process_events(db, runtime)
    started += await run_due_schedules(db, runtime)
    started += await recover_stuck_runs(db, runtime)
    for run_id in started:
        if execute_inline:
            await runtime.execute(run_id)
        else:
            runtime.kick(run_id)
    return {"paused": False, "started": started}


async def _loop(get_db) -> None:
    interval = int(os.getenv("AGENT_WORKER_INTERVAL", "20"))
    while True:
        try:
            db = await get_db()
            await tick(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("agent worker tick failed")
        await asyncio.sleep(interval)


def start_worker(get_db) -> None:
    global _task
    if os.getenv("AGENT_WORKER", "1") == "0":
        log.info("agent worker disabled by AGENT_WORKER=0")
        return
    if _task is None or _task.done():
        _task = asyncio.get_event_loop().create_task(_loop(get_db))


async def stop_worker() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass
    _task = None
