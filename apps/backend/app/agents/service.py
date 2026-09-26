"""Agent OS bootstrap: indexes, seed data, background worker."""
from __future__ import annotations

import logging

from .core.store import ensure_agent_indexes
from .core.workflows import seed_workflows
from .core.worker import start_worker, stop_worker

log = logging.getLogger("agent_os")


async def startup(get_db) -> None:
    try:
        db = await get_db()
        await ensure_agent_indexes(db)
        await seed_workflows(db)
    except Exception as e:  # DB down must not stop the storefront API from booting
        log.warning("Agent OS bootstrap skipped: %s", e)
    start_worker(get_db)


async def shutdown() -> None:
    await stop_worker()
