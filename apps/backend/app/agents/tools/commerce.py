"""Orders, customers, custom requests, inventory and customer messages."""
from __future__ import annotations

import re
from typing import Any

from ..core.config import get_settings
from ..core.events import emit_event
from ..core.store import (
    CUSTOMERS,
    INVENTORY,
    INVENTORY_MOVEMENTS,
    MESSAGES,
    ORDER_STATUSES,
    ORDERS,
    PRODUCTS,
    REQUEST_STATUSES,
    REQUESTS,
    clean,
    days_ago_iso,
    now_iso,
    uid,
)
from ..core.tools import ToolContext, ToolError, tool


# ----------------------------------------------------------------- helpers
def order_total(order: dict) -> float:
    total = 0.0
    for it in order.get("items") or []:
        total += float((it.get("unitPrice") or {}).get("amount") or 0) * int(it.get("quantity") or 0)
    return round(total, 2)


def order_view(o: dict, full: bool = False) -> dict:
    c = o.get("customer") or {}
    v = {
        "number": o.get("number"),
        "status": o.get("status"),
        "created_at": o.get("createdAt"),
        "customer": {"name": c.get("name"), "email": c.get("email"), "phone": c.get("phone"), "city": c.get("city")},
        "items": [
            {
                "product_slug": it.get("productSlug"),
                "variant_id": it.get("variantId"),
                "name": it.get("name"),
                "variant": it.get("variantLabel"),
                "quantity": it.get("quantity"),
                "unit_price": (it.get("unitPrice") or {}).get("amount"),
            }
            for it in (o.get("items") or [])
        ],
        "total_inr": order_total(o),
    }
    if full:
        v["shipping_address"] = ", ".join(
            str(x) for x in [c.get("address1"), c.get("address2"), c.get("city"), c.get("state"), c.get("postalCode"), c.get("country")] if x
        )
        v["events"] = [{"at": e.get("at"), "title": e.get("title"), "description": e.get("description")} for e in (o.get("events") or [])][-10:]
        v["internal_notes"] = o.get("internal_notes") or []
    return v


def sku_for(product_slug: str, variant_id: str) -> str:
    return f"{product_slug}:{variant_id}"


async def _get_order(db, number: str) -> dict:
    o = await db[ORDERS].find_one({"number": (number or "").strip().upper()})
    if not o:
        raise ToolError(f"Order {number} not found")
    return o


async def upsert_customer_from_order(db, order: dict, channel: str = "website") -> str | None:
    """Keep the customers collection in sync with orders. Safe to call repeatedly."""
    c = order.get("customer") or {}
    email = (c.get("email") or "").strip().lower()
    if not email:
        return None
    total = order_total(order)
    existing = await db[CUSTOMERS].find_one({"email": email})
    if existing:
        if order.get("number") in (existing.get("order_numbers") or []):
            return existing["_id"]
        await db[CUSTOMERS].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {"name": c.get("name") or existing.get("name"), "phone": c.get("phone") or existing.get("phone"),
                         "city": c.get("city") or existing.get("city"), "last_order_at": order.get("createdAt"), "updated_at": now_iso()},
                "$inc": {"order_count": 1, "lifetime_value": total},
                "$push": {"order_numbers": order.get("number")},
            },
        )
        return existing["_id"]
    doc = {
        "_id": uid("cus"),
        "email": email,
        "name": c.get("name"),
        "phone": c.get("phone"),
        "city": c.get("city"),
        "instagram": None,
        "channels": [channel],
        "order_count": 1,
        "lifetime_value": total,
        "order_numbers": [order.get("number")],
        "first_order_at": order.get("createdAt"),
        "last_order_at": order.get("createdAt"),
        "notes": [],
        "tags": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db[CUSTOMERS].insert_one(doc)
    return doc["_id"]


# ----------------------------------------------------------------- orders (read)
@tool(
    "get_order",
    "Look up one order by its number (e.g. TI-4821): status, items, customer, shipping address, timeline and internal notes.",
    {"type": "object", "properties": {"order_number": {"type": "string"}}, "required": ["order_number"]},
    label="Get order",
)
async def get_order(ctx: ToolContext, order_number: str) -> dict:
    return order_view(await _get_order(ctx.db, order_number), full=True)


@tool(
    "list_orders",
    "List recent orders, newest first. Filter by status and/or age. Use older_than_days to find stuck orders.",
    {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ORDER_STATUSES},
            "since_days": {"type": "number", "description": "Only orders created in the last N days"},
            "older_than_days": {"type": "number", "description": "Only orders created more than N days ago"},
            "customer_email": {"type": "string"},
            "limit": {"type": "integer", "default": 20, "maximum": 100},
        },
    },
    label="List orders",
)
async def list_orders(ctx: ToolContext, status: str | None = None, since_days: float | None = None,
                      older_than_days: float | None = None, customer_email: str | None = None, limit: int = 20) -> dict:
    q: dict[str, Any] = {}
    if status:
        q["status"] = status
    created: dict[str, str] = {}
    if since_days is not None:
        created["$gte"] = days_ago_iso(since_days)
    if older_than_days is not None:
        created["$lte"] = days_ago_iso(older_than_days)
    if created:
        q["createdAt"] = created
    if customer_email:
        q["customer.email"] = {"$regex": f"^{re.escape(customer_email.strip())}$", "$options": "i"}
    docs = await ctx.db[ORDERS].find(q).sort("createdAt", -1).limit(min(int(limit or 20), 100)).to_list(100)
    return {"count": len(docs), "orders": [order_view(d) for d in docs]}


# ----------------------------------------------------------------- orders (action)
async def _validate_status(ctx: ToolContext, order_number: str, status: str, **_: Any) -> None:
    if status not in ORDER_STATUSES:
        raise ToolError(f"Invalid status. Use one of {ORDER_STATUSES}")
    o = await _get_order(ctx.db, order_number)
    if o.get("status") == status:
        raise ToolError(f"Order is already '{status}'")


@tool(
    "update_order_status",
    "Move an order to a new status and add a customer-visible timeline event (shown on Track Order).",
    {
        "type": "object",
        "properties": {
            "order_number": {"type": "string"},
            "status": {"type": "string", "enum": ORDER_STATUSES},
            "customer_note": {"type": "string", "description": "Short customer-visible description for the timeline"},
        },
        "required": ["order_number", "status"],
    },
    risk="action",
    label="Update order status",
    summarize=lambda a: f"Move order {a.get('order_number')} to '{a.get('status')}'",
    validate=_validate_status,
)
async def update_order_status(ctx: ToolContext, order_number: str, status: str, customer_note: str | None = None) -> dict:
    await _validate_status(ctx, order_number, status)
    o = await _get_order(ctx.db, order_number)
    event = {"id": uid("e"), "at": now_iso(), "title": status}
    if customer_note:
        event["description"] = customer_note
    await ctx.db[ORDERS].update_one({"_id": o["_id"]}, {"$set": {"status": status}, "$push": {"events": event}})
    await emit_event(ctx.db, "order.status_changed", {"order_number": o["number"], "from": o.get("status"), "to": status}, source=ctx.agent)
    return {"order_number": o["number"], "from": o.get("status"), "to": status}


@tool(
    "add_order_note",
    "Add an internal (not customer-visible) note to an order, e.g. production details or issues.",
    {"type": "object", "properties": {"order_number": {"type": "string"}, "note": {"type": "string"}}, "required": ["order_number", "note"]},
    risk="draft",
    label="Add order note",
)
async def add_order_note(ctx: ToolContext, order_number: str, note: str) -> dict:
    o = await _get_order(ctx.db, order_number)
    await ctx.db[ORDERS].update_one(
        {"_id": o["_id"]}, {"$push": {"internal_notes": {"at": now_iso(), "by": ctx.agent, "note": note[:2000]}}}
    )
    return {"ok": True}


# ----------------------------------------------------------------- customers
@tool(
    "find_customer",
    "Find customers by email, phone, name or Instagram handle (partial match). Returns order count, lifetime value and notes.",
    {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    label="Find customer",
)
async def find_customer(ctx: ToolContext, query: str) -> dict:
    rx = {"$regex": re.escape(query.strip().lstrip("@")), "$options": "i"}
    docs = await ctx.db[CUSTOMERS].find(
        {"$or": [{"email": rx}, {"phone": rx}, {"name": rx}, {"instagram": rx}]}
    ).limit(10).to_list(10)
    return {"customers": clean(docs)}


@tool(
    "add_customer_note",
    "Save a note or tag about a customer (preferences, issues, VIP). Creates the customer record if needed.",
    {
        "type": "object",
        "properties": {
            "email": {"type": "string"},
            "note": {"type": "string"},
            "tags": {"type": "array", "items": {"type": "string"}},
            "instagram": {"type": "string"},
        },
        "required": ["email", "note"],
    },
    risk="draft",
    label="Add customer note",
)
async def add_customer_note(ctx: ToolContext, email: str, note: str, tags: list[str] | None = None, instagram: str | None = None) -> dict:
    email = email.strip().lower()
    update: dict[str, Any] = {
        "$push": {"notes": {"at": now_iso(), "by": ctx.agent, "note": note[:2000]}},
        "$set": {"updated_at": now_iso()},
        "$setOnInsert": {"_id": uid("cus"), "email": email, "created_at": now_iso(), "order_count": 0, "lifetime_value": 0},
    }
    if instagram:
        update["$set"]["instagram"] = instagram.lstrip("@")
    if tags:
        update["$addToSet"] = {"tags": {"$each": tags}}
    await ctx.db[CUSTOMERS].update_one({"email": email}, update, upsert=True)
    return {"ok": True}


# ----------------------------------------------------------------- custom requests
def request_view(r: dict) -> dict:
    return {
        "request_id": r.get("requestId"),
        "type": r.get("type"),
        "status": r.get("status"),
        "created_at": r.get("createdAt"),
        "details": r.get("received"),
        "notes": r.get("internal_notes") or [],
    }


@tool(
    "list_requests",
    "List customized-gifting and PYOT (print your own toy) requests, newest first.",
    {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": ["gifting", "pyot"]},
            "status": {"type": "string"},
            "older_than_days": {"type": "number"},
            "limit": {"type": "integer", "default": 20},
        },
    },
    label="List custom requests",
)
async def list_requests(ctx: ToolContext, type: str | None = None, status: str | None = None,
                        older_than_days: float | None = None, limit: int = 20) -> dict:
    q: dict[str, Any] = {}
    if type:
        q["type"] = type
    if status:
        q["status"] = status
    if older_than_days is not None:
        q["createdAt"] = {"$lte": days_ago_iso(older_than_days)}
    docs = await ctx.db[REQUESTS].find(q).sort("createdAt", -1).limit(min(int(limit or 20), 100)).to_list(100)
    return {"count": len(docs), "requests": [request_view(d) for d in docs]}


@tool(
    "get_request",
    "Get one custom request by request_id.",
    {"type": "object", "properties": {"request_id": {"type": "string"}}, "required": ["request_id"]},
    label="Get custom request",
)
async def get_request(ctx: ToolContext, request_id: str) -> dict:
    r = await ctx.db[REQUESTS].find_one({"requestId": request_id})
    if not r:
        raise ToolError("Request not found")
    return request_view(r)


async def _validate_request_status(ctx: ToolContext, request_id: str, status: str, **_: Any) -> None:
    if status not in REQUEST_STATUSES:
        raise ToolError(f"Invalid status. Use one of {REQUEST_STATUSES}")
    if not await ctx.db[REQUESTS].find_one({"requestId": request_id}):
        raise ToolError("Request not found")


@tool(
    "update_request_status",
    "Change a custom request's status (e.g. In review, Quoted, Accepted, Declined).",
    {
        "type": "object",
        "properties": {
            "request_id": {"type": "string"},
            "status": {"type": "string", "enum": REQUEST_STATUSES},
            "note": {"type": "string"},
        },
        "required": ["request_id", "status"],
    },
    risk="action",
    label="Update request status",
    summarize=lambda a: f"Move request {a.get('request_id')} to '{a.get('status')}'",
    validate=_validate_request_status,
)
async def update_request_status(ctx: ToolContext, request_id: str, status: str, note: str | None = None) -> dict:
    await _validate_request_status(ctx, request_id, status)
    upd: dict[str, Any] = {"$set": {"status": status, "updatedAt": now_iso()}}
    if note:
        upd["$push"] = {"internal_notes": {"at": now_iso(), "by": ctx.actor, "note": note}}
    await ctx.db[REQUESTS].update_one({"requestId": request_id}, upd)
    return {"request_id": request_id, "status": status}


# ----------------------------------------------------------------- inventory
async def inventory_for(db, product_slug: str, variant_id: str) -> dict | None:
    return await db[INVENTORY].find_one({"sku": sku_for(product_slug, variant_id)})


@tool(
    "check_stock",
    "Check stock for an order's items, or for a product (all variants). Items with no inventory record are made-to-order.",
    {
        "type": "object",
        "properties": {"order_number": {"type": "string"}, "product_slug": {"type": "string"}},
    },
    label="Check stock",
)
async def check_stock(ctx: ToolContext, order_number: str | None = None, product_slug: str | None = None) -> dict:
    lines: list[tuple[str, str, int]] = []
    if order_number:
        o = await _get_order(ctx.db, order_number)
        lines = [(it.get("productSlug"), it.get("variantId"), int(it.get("quantity") or 0)) for it in o.get("items") or []]
    elif product_slug:
        p = await ctx.db[PRODUCTS].find_one({"slug": product_slug})
        if not p:
            raise ToolError("Product not found")
        lines = [(product_slug, v.get("id"), 0) for v in p.get("variants") or []]
    else:
        raise ToolError("Give order_number or product_slug")
    out = []
    for slug, vid, qty in lines:
        inv = await inventory_for(ctx.db, slug, vid)
        if not inv:
            out.append({"sku": sku_for(slug, vid), "tracked": False, "made_to_order": True, "needed": qty, "can_fulfil": True})
            continue
        available = int(inv.get("on_hand") or 0) - int(inv.get("reserved") or 0)
        out.append({
            "sku": inv["sku"], "tracked": True, "made_to_order": bool(inv.get("made_to_order")),
            "on_hand": inv.get("on_hand"), "reserved": inv.get("reserved"), "available": available, "needed": qty,
            "can_fulfil": bool(inv.get("made_to_order")) or available >= qty,
        })
    return {"items": out}


@tool(
    "list_low_stock",
    "List tracked SKUs at or below their reorder point (or the global low-stock threshold).",
    {"type": "object", "properties": {}},
    label="List low stock",
)
async def list_low_stock(ctx: ToolContext) -> dict:
    s = await get_settings(ctx.db)
    thr = int(s.get("low_stock_threshold") or 3)
    docs = await ctx.db[INVENTORY].find({"made_to_order": {"$ne": True}}).to_list(1000)
    low = []
    for d in docs:
        avail = int(d.get("on_hand") or 0) - int(d.get("reserved") or 0)
        if avail <= int(d.get("reorder_point") if d.get("reorder_point") is not None else thr):
            low.append({"sku": d["sku"], "name": d.get("name"), "available": avail, "reorder_point": d.get("reorder_point", thr)})
    return {"low_stock": low}


async def _validate_adjust(ctx: ToolContext, sku: str, delta: int, **_: Any) -> None:
    if ":" not in sku:
        raise ToolError("SKU must look like <product-slug>:<variant-id>")
    slug, vid = sku.split(":", 1)
    p = await ctx.db[PRODUCTS].find_one({"slug": slug})
    if not p or not any(v.get("id") == vid for v in p.get("variants") or []):
        raise ToolError("Unknown product/variant for this SKU")
    if int(delta) == 0:
        raise ToolError("delta must be non-zero")


@tool(
    "adjust_inventory",
    "Change on-hand stock for a SKU (<product-slug>:<variant-id>) by delta (positive = printed/restocked, negative = used/damaged). Creates the inventory record if needed.",
    {
        "type": "object",
        "properties": {
            "sku": {"type": "string"},
            "delta": {"type": "integer"},
            "movement_reason": {"type": "string", "enum": ["printed", "restock", "sold", "damaged", "correction", "reserved", "released"]},
            "order_number": {"type": "string"},
        },
        "required": ["sku", "delta", "movement_reason"],
    },
    risk="action",
    label="Adjust inventory",
    summarize=lambda a: f"{'+' if int(a.get('delta', 0)) > 0 else ''}{a.get('delta')} × {a.get('sku')} ({a.get('movement_reason')})",
    validate=_validate_adjust,
)
async def adjust_inventory(ctx: ToolContext, sku: str, delta: int, movement_reason: str, order_number: str | None = None) -> dict:
    await _validate_adjust(ctx, sku, delta)
    slug, vid = sku.split(":", 1)
    field = "reserved" if movement_reason in ("reserved", "released") else "on_hand"
    d = int(delta) if movement_reason != "released" else -abs(int(delta))
    p = await ctx.db[PRODUCTS].find_one({"slug": slug})
    variant = next((v for v in p.get("variants") or [] if v.get("id") == vid), {})
    await ctx.db[INVENTORY].update_one(
        {"sku": sku},
        {
            "$inc": {field: d},
            "$set": {"updated_at": now_iso()},
            "$setOnInsert": {"_id": uid("inv"), "sku": sku, "product_slug": slug, "variant_id": vid,
                             "name": f"{p.get('name')} — {variant.get('label', vid)}", "made_to_order": False,
                             "reorder_point": None, **({"reserved": 0} if field == "on_hand" else {"on_hand": 0})},
        },
        upsert=True,
    )
    await ctx.db[INVENTORY_MOVEMENTS].insert_one({
        "_id": uid("mov"), "sku": sku, "field": field, "delta": d, "reason": movement_reason,
        "order_number": order_number, "by": ctx.actor, "agent": ctx.agent, "at": now_iso(),
    })
    inv = await ctx.db[INVENTORY].find_one({"sku": sku})
    s = await get_settings(ctx.db)
    avail = int(inv.get("on_hand") or 0) - int(inv.get("reserved") or 0)
    thr = inv.get("reorder_point") if inv.get("reorder_point") is not None else s.get("low_stock_threshold", 3)
    if avail <= int(thr):
        await emit_event(ctx.db, "inventory.low", {"sku": sku, "available": avail}, source=ctx.agent)
    return {"sku": sku, "on_hand": inv.get("on_hand"), "reserved": inv.get("reserved"), "available": avail}


# ----------------------------------------------------------------- messages
@tool(
    "list_messages",
    "List customer messages: inbound (from customers) and drafts/sent replies.",
    {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["received", "draft", "approved", "sent", "ready_to_send"]},
            "customer": {"type": "string", "description": "email or instagram handle"},
            "limit": {"type": "integer", "default": 20},
        },
    },
    label="List messages",
)
async def list_messages(ctx: ToolContext, status: str | None = None, customer: str | None = None, limit: int = 20) -> dict:
    q: dict[str, Any] = {}
    if status:
        q["status"] = status
    if customer:
        q["$or"] = [{"to": customer}, {"from": customer}]
    docs = await ctx.db[MESSAGES].find(q).sort("created_at", -1).limit(min(int(limit or 20), 100)).to_list(100)
    return {"messages": clean(docs)}


@tool(
    "draft_customer_message",
    "Draft a message to a customer (saved as a draft, NOT sent). Use send_customer_message to request sending.",
    {
        "type": "object",
        "properties": {
            "channel": {"type": "string", "enum": ["email", "instagram", "whatsapp"]},
            "to": {"type": "string", "description": "email address or instagram handle"},
            "customer_name": {"type": "string"},
            "subject": {"type": "string", "description": "email subject (email only)"},
            "body": {"type": "string"},
            "order_number": {"type": "string"},
            "request_id": {"type": "string"},
            "in_reply_to": {"type": "string", "description": "id of the inbound message being answered"},
        },
        "required": ["channel", "to", "body"],
    },
    risk="draft",
    label="Draft customer message",
)
async def draft_customer_message(ctx: ToolContext, channel: str, to: str, body: str, customer_name: str | None = None,
                                 subject: str | None = None, order_number: str | None = None,
                                 request_id: str | None = None, in_reply_to: str | None = None) -> dict:
    doc = {
        "_id": uid("msg"), "direction": "outbound", "channel": channel, "to": to.strip(), "customer_name": customer_name,
        "subject": subject, "body": body.strip(), "order_number": order_number, "request_id": request_id,
        "in_reply_to": in_reply_to, "status": "draft", "created_by": ctx.agent, "run_id": ctx.run_id, "created_at": now_iso(),
    }
    await ctx.db[MESSAGES].insert_one(doc)
    return {"message_id": doc["_id"], "status": "draft"}


async def _validate_send(ctx: ToolContext, message_id: str, **_: Any) -> None:
    m = await ctx.db[MESSAGES].find_one({"_id": message_id})
    if not m:
        raise ToolError("Message not found; draft it first with draft_customer_message")
    if m.get("status") not in ("draft",):
        raise ToolError(f"Message is already {m.get('status')}")


def _summ_send(a: dict) -> str:
    return f"Send drafted message {a.get('message_id')} to customer"


@tool(
    "send_customer_message",
    "Request sending a drafted customer message. The owner sees the full text on the approval card.",
    {"type": "object", "properties": {"message_id": {"type": "string"}}, "required": ["message_id"]},
    risk="action",
    label="Send customer message",
    summarize=_summ_send,
    validate=_validate_send,
)
async def send_customer_message(ctx: ToolContext, message_id: str) -> dict:
    from ..integrations.channels import deliver

    m = await ctx.db[MESSAGES].find_one({"_id": message_id})
    if not m:
        raise ToolError("Message not found")
    result = await deliver(m)
    await ctx.db[MESSAGES].update_one(
        {"_id": message_id}, {"$set": {"status": result["status"], "delivery": result, "sent_at": now_iso(), "approved_by": ctx.actor}}
    )
    return {"message_id": message_id, **result}
