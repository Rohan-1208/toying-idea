"""Analytics over the central database (Product Intelligence agent)."""
from __future__ import annotations

from collections import Counter
from typing import Any

from ..core.store import CONTENT, CUSTOMERS, INSIGHTS, ORDERS, REQUESTS, clean, days_ago_iso, now_iso, uid
from ..core.tools import ToolContext, tool
from .catalog import product_sales
from .commerce import order_total


@tool(
    "sales_summary",
    "Orders and revenue over the last N days: totals, average order value, status pipeline, daily series, top products, "
    "and comparison with the previous period of equal length.",
    {"type": "object", "properties": {"days": {"type": "number", "default": 7}}},
    label="Sales summary",
)
async def sales_summary(ctx: ToolContext, days: float = 7) -> dict:
    cur = await ctx.db[ORDERS].find({"createdAt": {"$gte": days_ago_iso(days)}}).to_list(10000)
    prev = await ctx.db[ORDERS].find({"createdAt": {"$gte": days_ago_iso(days * 2), "$lt": days_ago_iso(days)}}).to_list(10000)

    def stats(orders: list[dict]) -> dict:
        valid = [o for o in orders if o.get("status") != "Cancelled"]
        rev = sum(order_total(o) for o in valid)
        return {"orders": len(valid), "revenue_inr": round(rev, 2), "aov_inr": round(rev / len(valid), 2) if valid else 0,
                "cancelled": len(orders) - len(valid)}

    daily: Counter = Counter()
    for o in cur:
        daily[str(o.get("createdAt", ""))[:10]] += 1
    pipeline = Counter(o.get("status") for o in await ctx.db[ORDERS].find({"status": {"$nin": ["Delivered", "Cancelled"]}}).to_list(10000))
    return {
        "days": days,
        "current": stats(cur),
        "previous": stats(prev),
        "open_pipeline_by_status": dict(pipeline),
        "orders_per_day": dict(sorted(daily.items())),
        "top_products": (await product_sales(ctx.db, days))[:10],
    }


@tool(
    "request_trends",
    "Custom gifting / PYOT requests over the last N days: counts by type and status, occasions, quantities, and raw notes to spot product ideas.",
    {"type": "object", "properties": {"days": {"type": "number", "default": 30}}},
    label="Request trends",
)
async def request_trends(ctx: ToolContext, days: float = 30) -> dict:
    docs = await ctx.db[REQUESTS].find({"createdAt": {"$gte": days_ago_iso(days)}}).to_list(5000)
    by_type = Counter(d.get("type") for d in docs)
    by_status = Counter(d.get("status") for d in docs)
    occasions = Counter(((d.get("received") or {}).get("occasion") or "").strip().lower() for d in docs if d.get("type") == "gifting")
    notes = []
    for d in docs[:40]:
        r = d.get("received") or {}
        notes.append({"type": d.get("type"), "text": (r.get("message") or r.get("notes") or "")[:300],
                      "qty": r.get("quantityRange") or r.get("quantity"), "material": r.get("material")})
    return {"days": days, "total": len(docs), "by_type": dict(by_type), "by_status": dict(by_status),
            "top_occasions": occasions.most_common(8), "samples": notes}


@tool(
    "customer_summary",
    "New vs returning customers, top customers by lifetime value, and repeat rate.",
    {"type": "object", "properties": {"days": {"type": "number", "default": 30}}},
    label="Customer summary",
)
async def customer_summary(ctx: ToolContext, days: float = 30) -> dict:
    new = await ctx.db[CUSTOMERS].count_documents({"created_at": {"$gte": days_ago_iso(days)}})
    total = await ctx.db[CUSTOMERS].count_documents({})
    repeat = await ctx.db[CUSTOMERS].count_documents({"order_count": {"$gte": 2}})
    top = await ctx.db[CUSTOMERS].find({}).sort("lifetime_value", -1).limit(5).to_list(5)
    return {"days": days, "new_customers": new, "total_customers": total, "repeat_customers": repeat,
            "repeat_rate_pct": round(repeat / total * 100, 1) if total else 0,
            "top_customers": [{"name": c.get("name"), "orders": c.get("order_count"), "ltv_inr": c.get("lifetime_value")} for c in top]}


@tool(
    "content_summary",
    "Content pipeline: drafts, scheduled and published counts, and engagement metrics where available.",
    {"type": "object", "properties": {}},
    label="Content summary",
)
async def content_summary(ctx: ToolContext) -> dict:
    docs = await ctx.db[CONTENT].find({}).sort("created_at", -1).limit(200).to_list(200)
    by_status = Counter(d.get("status") for d in docs)
    with_metrics = [{"title": d.get("title"), "type": d.get("type"), **(d.get("metrics") or {})} for d in docs if d.get("metrics")]
    return {"by_status": dict(by_status), "with_metrics": with_metrics[:20]}


@tool(
    "list_insights",
    "Previous reports and recommendations, newest first (to avoid repeating yourself and to track follow-ups).",
    {"type": "object", "properties": {"limit": {"type": "integer", "default": 5}}},
    label="List insights",
)
async def list_insights(ctx: ToolContext, limit: int = 5) -> dict:
    docs = await ctx.db[INSIGHTS].find({}).sort("created_at", -1).limit(min(int(limit or 5), 30)).to_list(30)
    return {"insights": clean(docs)}


@tool(
    "save_insight",
    "Save a report with prioritised recommendations. This is what the owner reads in the dashboard.",
    {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "kind": {"type": "string", "enum": ["daily_brief", "weekly_opportunities", "analysis", "alert"]},
            "summary": {"type": "string", "description": "markdown, 3-10 bullets"},
            "metrics": {"type": "object"},
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "rationale": {"type": "string"},
                        "category": {"type": "string", "enum": ["promote", "restock", "retire", "new_product", "pricing", "operations", "content"]},
                        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                        "suggested_agent": {"type": "string"},
                    },
                    "required": ["title", "rationale", "priority"],
                },
            },
        },
        "required": ["title", "kind", "summary"],
    },
    risk="draft",
    label="Save insight",
)
async def save_insight(ctx: ToolContext, title: str, kind: str, summary: str, metrics: dict | None = None,
                       recommendations: list[dict] | None = None) -> dict:
    doc: dict[str, Any] = {
        "_id": uid("ins"), "title": title, "kind": kind, "summary": summary, "metrics": metrics or {},
        "recommendations": [{**r, "status": "open"} for r in (recommendations or [])],
        "created_by": ctx.agent, "run_id": ctx.run_id, "created_at": now_iso(),
    }
    await ctx.db[INSIGHTS].insert_one(doc)
    return {"insight_id": doc["_id"]}
