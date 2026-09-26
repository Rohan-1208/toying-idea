from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timezone
import secrets
from ..db import get_db
from ..deps import get_current_user, require_admin
from ..mongo import normalize_id, normalize_ids, object_id
from ..agents.core.events import emit_event


router = APIRouter(tags=["orders"])

def uid(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(8)}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Money(BaseModel):
    currency: str = "INR"
    amount: float


class OrderItem(BaseModel):
    productSlug: str
    variantId: str
    quantity: int
    unitPrice: Money


class OrderCreate(BaseModel):
    items: list[OrderItem]


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(payload: OrderCreate, user=Depends(get_current_user)):
    db = await get_db()
    items: list[dict] = []
    for item in payload.items:
        product = await db["products"].find_one({"slug": item.productSlug, "active": True})
        variant = None
        if product:
            variant = next((v for v in (product.get("variants") or []) if v.get("id") == item.variantId), None)
        if not product or not variant:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product/variant")
        unit_price = variant.get("price") or {"currency": "INR", "amount": 0}
        items.append(
            {
                "productSlug": item.productSlug,
                "variantId": item.variantId,
                "quantity": item.quantity,
                "unitPrice": unit_price,
            }
        )

    number = f"TI-{secrets.randbelow(9000) + 1000}"
    doc = {
        "user_id": object_id(user["id"]),
        "number": number,
        "createdAt": now_iso(),
        "status": "Placed",
        "items": items,
        "events": [
            {
                "id": uid("e"),
                "at": now_iso(),
                "title": "Order placed",
                "description": "Payment confirmed. Your build is queued.",
            }
        ],
    }
    res = await db["orders"].insert_one(doc)
    created = await db["orders"].find_one({"_id": res.inserted_id})
    return normalize_id(created)


@router.get("/orders")
async def list_my_orders(user=Depends(get_current_user)):
    db = await get_db()
    cursor = db["orders"].find({"user_id": object_id(user["id"])})
    docs = await cursor.to_list(length=200)
    return normalize_ids(docs)


@router.get("/admin/orders")
async def admin_list_orders(admin=Depends(require_admin)):
    db = await get_db()
    cursor = db["orders"].find({})
    docs = await cursor.to_list(length=500)
    return normalize_ids(docs)


@router.put("/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, status_value: str, admin=Depends(require_admin)):
    db = await get_db()
    event = {"id": uid("e"), "at": now_iso(), "title": status_value}
    before = await db["orders"].find_one({"_id": object_id(order_id)})
    await db["orders"].update_one(
        {"_id": object_id(order_id)},
        {"$set": {"status": status_value}, "$push": {"events": event}},
    )
    updated = await db["orders"].find_one({"_id": object_id(order_id)})
    updated = normalize_id(updated)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    await emit_event(
        db,
        "order.status_changed",
        {"order_number": updated.get("number"), "from": (before or {}).get("status"), "to": status_value, "by": admin.get("email")},
        source="admin",
    )
    return updated
