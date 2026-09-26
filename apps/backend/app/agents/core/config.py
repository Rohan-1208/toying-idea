"""Global Agent OS settings and per-agent configuration stored in MongoDB."""
from __future__ import annotations

import copy
from typing import Any

from .store import AGENTS, SETTINGS, now_iso

DEFAULT_SETTINGS: dict[str, Any] = {
    "paused": False,
    "daily_run_budget": 200,
    "max_steps": 12,
    "utc_offset_minutes": 330,  # IST
    "business": {
        "name": "Toying Idea",
        "currency": "INR",
        "tone": "warm, playful, concise; Indian English; no over-promising on delivery dates",
        "production_lead_days": "3-5 working days to print, 2-6 days shipping within India",
    },
    # Cost model used by the pricing calculator (INR).
    "pricing": {
        "filament_cost_per_kg": {"PLA": 1100, "PETG": 1300, "TPU": 2200, "Silk PLA": 1500, "Resin": 3500},
        "machine_cost_per_hour": 25,
        "labour_cost_per_hour": 150,
        "failure_rate": 0.1,
        "packaging_cost": 40,
        "platform_fee_pct": 2.0,
        "gst_pct": 18.0,
        "default_target_margin_pct": 55,
        "round_to": 49,  # prices end in 49 / 99
    },
    "low_stock_threshold": 3,
}


def _deep_merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


async def get_settings(db) -> dict:
    doc = await db[SETTINGS].find_one({"_id": "global"}) or {}
    doc.pop("_id", None)
    return _deep_merge(DEFAULT_SETTINGS, doc)


async def update_settings(db, patch: dict) -> dict:
    allowed = {"paused", "daily_run_budget", "max_steps", "utc_offset_minutes", "business", "pricing", "low_stock_threshold"}
    patch = {k: v for k, v in patch.items() if k in allowed}
    current = await get_settings(db)
    merged = _deep_merge(current, patch)
    merged["updated_at"] = now_iso()
    await db[SETTINGS].update_one({"_id": "global"}, {"$set": merged}, upsert=True)
    return await get_settings(db)


async def get_agent_config(db, key: str) -> dict:
    """Agent definition defaults merged with dashboard overrides."""
    from ..definitions.registry import AGENT_DEFS

    d = AGENT_DEFS[key]
    doc = await db[AGENTS].find_one({"_id": key}) or {}
    return {
        "key": key,
        "name": d.name,
        "role": d.role,
        "description": d.description,
        "enabled": doc.get("enabled", True),
        "model": doc.get("model") or d.default_model,
        "auto_approve_tools": list(doc.get("auto_approve_tools") or d.default_auto_approve),
        "instructions": doc.get("instructions", ""),
        "tools": list(d.tools),
        "updated_at": doc.get("updated_at"),
    }


async def update_agent_config(db, key: str, patch: dict) -> dict:
    allowed = {"enabled", "model", "auto_approve_tools", "instructions"}
    data = {k: v for k, v in patch.items() if k in allowed}
    data["updated_at"] = now_iso()
    await db[AGENTS].update_one({"_id": key}, {"$set": data}, upsert=True)
    return await get_agent_config(db, key)
