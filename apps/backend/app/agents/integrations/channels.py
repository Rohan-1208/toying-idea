"""Outbound customer-message delivery.

Phase 1: email via Resend (official HTTP API) when RESEND_API_KEY + EMAIL_FROM are set.
Instagram DMs (Messaging API) and WhatsApp arrive in Phase 2; until a channel is
configured, approved messages are marked `ready_to_send` so the owner can copy
them from the dashboard. Nothing is ever silently dropped.
"""
from __future__ import annotations

import os

import httpx


def channel_status() -> dict:
    return {
        "email": bool(os.getenv("RESEND_API_KEY") and os.getenv("EMAIL_FROM")),
        "instagram": False,  # Phase 2
        "whatsapp": False,
    }


async def _send_email(m: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
            json={
                "from": os.environ["EMAIL_FROM"],
                "to": [m["to"]],
                "subject": m.get("subject") or "Your Toying Idea order",
                "text": m["body"],
                **({"reply_to": os.environ["EMAIL_REPLY_TO"]} if os.getenv("EMAIL_REPLY_TO") else {}),
            },
        )
    if res.status_code >= 400:
        raise RuntimeError(f"Email provider error {res.status_code}: {res.text[:300]}")
    return {"status": "sent", "provider": "resend", "provider_id": (res.json() or {}).get("id")}


async def deliver(m: dict) -> dict:
    ch = m.get("channel")
    if ch == "email" and channel_status()["email"]:
        return await _send_email(m)
    return {
        "status": "ready_to_send",
        "provider": None,
        "note": f"No {ch} integration configured yet. Copy the approved text from the dashboard and send it manually.",
    }
