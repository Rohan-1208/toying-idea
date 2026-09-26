from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timezone
import secrets

from ..db import get_db
from ..agents.core.events import emit_event


router = APIRouter(prefix="/requests", tags=["requests"])


def uid(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(10)}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class GiftingRequest(BaseModel):
    occasion: str
    message: str
    brandingNotes: str | None = None
    quantityRange: str
    email: str
    name: str


class PyotRequest(BaseModel):
    files: list[dict]
    referenceImages: list[dict] = []
    material: str
    finish: str
    quantity: int
    notes: str | None = None


@router.post("/gifting")
async def create_gifting_request(payload: GiftingRequest):
    db = await get_db()
    doc = {
        "type": "gifting",
        "requestId": uid("gift"),
        "status": "Received",
        "received": payload.model_dump(),
        "createdAt": now_iso(),
    }
    await db["requests"].insert_one(doc)
    await emit_event(db, "request.created", {"request_id": doc["requestId"], "type": doc["type"]}, source="storefront")
    return {
        "requestId": doc["requestId"],
        "status": doc["status"],
        "received": doc["received"],
        "message": "Thanks—our team will reach out with options and timelines.",
    }


@router.post("/pyot")
async def create_pyot_request(payload: PyotRequest):
    db = await get_db()
    doc = {
        "type": "pyot",
        "requestId": uid("pyot"),
        "status": "Queued",
        "received": payload.model_dump(),
        "createdAt": now_iso(),
    }
    await db["requests"].insert_one(doc)
    await emit_event(db, "request.created", {"request_id": doc["requestId"], "type": doc["type"]}, source="storefront")
    return {
        "requestId": doc["requestId"],
        "status": doc["status"],
        "received": doc["received"],
        "message": "Your files were received. We'll review printability and respond with a quote.",
    }

