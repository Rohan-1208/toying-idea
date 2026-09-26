"""Collection names, id/time helpers and indexes for the Agent OS."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

# --- Collections -----------------------------------------------------------
# Existing commerce collections
PRODUCTS = "products"
ORDERS = "orders"
REQUESTS = "requests"
USERS = "users"
# Business data added by the Agent OS
CUSTOMERS = "customers"
INVENTORY = "inventory"
INVENTORY_MOVEMENTS = "inventory_movements"
MESSAGES = "messages"
CONTENT = "content"
ASSETS = "assets"
INSIGHTS = "insights"
# Agent control plane
AGENTS = "agents"
WORKFLOWS = "workflows"
SETTINGS = "agent_settings"
RUNS = "agent_runs"
ACTIONS = "agent_actions"
EVENTS = "events"

ORDER_STATUSES = ["Placed", "In production", "Quality check", "Shipped", "Delivered", "Cancelled"]
REQUEST_STATUSES = ["Received", "Queued", "In review", "Quoted", "Accepted", "In production", "Completed", "Declined"]


def uid(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(9).replace('-', 'x').replace('_', 'y')}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return utcnow().isoformat()


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def days_ago_iso(days: float) -> str:
    return iso(utcnow() - timedelta(days=days))


def start_of_utc_day_iso() -> str:
    n = utcnow()
    return iso(datetime(n.year, n.month, n.day, tzinfo=timezone.utc))


def clean(doc: Any) -> Any:
    """Make a Mongo document JSON-safe (ObjectId -> str, _id -> id)."""
    if isinstance(doc, list):
        return [clean(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            key = "id" if k == "_id" else k
            out[key] = clean(v)
        return out
    if isinstance(doc, (str, int, float, bool)) or doc is None:
        return doc
    if isinstance(doc, datetime):
        return iso(doc)
    return str(doc)


async def ensure_agent_indexes(db) -> None:
    specs = [
        (RUNS, [("created_at", -1)]),
        (RUNS, [("status", 1)]),
        (RUNS, [("agent", 1), ("created_at", -1)]),
        (ACTIONS, [("status", 1), ("created_at", -1)]),
        (EVENTS, [("status", 1), ("created_at", 1)]),
        (WORKFLOWS, [("enabled", 1), ("next_run_at", 1)]),
        (CUSTOMERS, [("email", 1)]),
        (INVENTORY, [("sku", 1)]),
        (MESSAGES, [("status", 1), ("created_at", -1)]),
        (CONTENT, [("status", 1), ("created_at", -1)]),
        (ASSETS, [("type", 1), ("created_at", -1)]),
        (INSIGHTS, [("created_at", -1)]),
    ]
    for coll, keys in specs:
        try:
            await db[coll].create_index(keys)
        except Exception:
            pass
