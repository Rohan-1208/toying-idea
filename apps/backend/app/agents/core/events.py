"""Event queue. Business code emits events; workflows subscribe to them."""
from __future__ import annotations

import logging

from .store import EVENTS, now_iso, uid

log = logging.getLogger("agent_os")

# Events the dashboard offers as workflow triggers.
EVENT_TYPES = {
    "order.created": "A website order was placed (checkout)",
    "order.status_changed": "An order's status changed",
    "request.created": "A customized gifting or PYOT request was submitted",
    "product.published": "A product went live on the storefront",
    "inventory.low": "A SKU fell to or below the low-stock threshold",
    "message.received": "An inbound customer message arrived (Instagram DM / email, Phase 2)",
    "action.executed": "An approved agent action finished",
    "action.failed": "An approved agent action failed",
    "run.finished": "An agent run finished",
}

# Internal bookkeeping events that never trigger workflows unless explicitly subscribed.
QUIET_EVENTS = {"run.finished", "action.executed", "action.failed"}


async def emit_event(db, type_: str, payload: dict | None = None, *, source: str = "system") -> str | None:
    """Record an event. Never raises: event emission must not break checkout etc."""
    try:
        doc = {
            "_id": uid("evt"),
            "type": type_,
            "payload": payload or {},
            "source": source,
            "status": "pending",
            "created_at": now_iso(),
            "run_ids": [],
        }
        await db[EVENTS].insert_one(doc)
        return doc["_id"]
    except Exception as e:  # pragma: no cover
        log.warning("emit_event failed: %s", e)
        return None
