from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel
from datetime import datetime, timezone
import secrets

from ..db import get_db
from ..mongo import normalize_id
from ..agents.core.events import emit_event
from ..agents.tools.commerce import upsert_customer_from_order


router = APIRouter(tags=["checkout"])


def uid(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(8)}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CheckoutCustomer(BaseModel):
    name: str
    email: str
    phone: str | None = None
    address1: str
    address2: str | None = None
    city: str
    state: str
    postalCode: str
    country: str = "IN"


class CheckoutInput(BaseModel):
    customer: CheckoutCustomer


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
async def checkout(payload: CheckoutInput, req: Request, res: Response):
    db = await get_db()
    session_id = req.cookies.get("ti_session")
    if not session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing cart session")

    cart = await db["carts"].find_one({"session_id": session_id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    items: list[dict] = []
    for item in cart.get("items") or []:
        product_slug = item.get("productSlug")
        variant_id = item.get("variantId")
        quantity = int(item.get("quantity") or 0)
        if not product_slug or not variant_id or quantity < 1:
            continue
        product = await db["products"].find_one({"slug": product_slug, "active": True})
        if not product:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product in cart")
        variant = next((v for v in (product.get("variants") or []) if v.get("id") == variant_id), None)
        if not variant:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid variant in cart")
        unit_price = variant.get("price") or {"currency": "USD", "amount": 0}
        items.append(
            {
                "productSlug": product_slug,
                "variantId": variant_id,
                "quantity": quantity,
                "unitPrice": unit_price,
                "name": product.get("name"),
                "variantLabel": variant.get("label"),
            }
        )

    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    number = None
    for _ in range(10):
        candidate = f"TI-{secrets.randbelow(9000) + 1000}"
        exists = await db["orders"].find_one({"number": candidate})
        if not exists:
            number = candidate
            break
    if not number:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not allocate order number")

    doc = {
        "number": number,
        "createdAt": now_iso(),
        "status": "Placed",
        "customer": payload.customer.model_dump(),
        "items": items,
        "events": [
            {
                "id": uid("e"),
                "at": now_iso(),
                "title": "Order placed",
                "description": "We received your details and queued production.",
            }
        ],
    }

    inserted = await db["orders"].insert_one(doc)
    created = await db["orders"].find_one({"_id": inserted.inserted_id})

    try:
        await upsert_customer_from_order(db, created)
    except Exception:
        pass
    await emit_event(db, "order.created", {"order_number": number, "customer_email": payload.customer.email}, source="checkout")

    await db["carts"].delete_one({"session_id": session_id})
    res.set_cookie("ti_last_order", number, httponly=True, samesite="lax", path="/")

    return {"order": normalize_id(created), "orderNumber": number}

