"""HTTP-level tests for the dashboard API and checkout -> event hook."""
from __future__ import annotations

import asyncio

import httpx
import pytest

from tests.fake_mongo import FakeDB


class SyncClient:
    """Minimal sync wrapper over httpx.ASGITransport (works across httpx/starlette versions)."""

    def __init__(self, app):
        self.app = app
        self.cookies = httpx.Cookies()

    def request(self, method, url, **kw):
        async def go():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url="http://test", cookies=self.cookies) as c:
                return await c.request(method, url, **kw)

        return asyncio.run(go())

    def get(self, url, **kw):
        return self.request("GET", url, **kw)

    def post(self, url, **kw):
        return self.request("POST", url, **kw)

    def patch(self, url, **kw):
        return self.request("PATCH", url, **kw)

    def delete(self, url, **kw):
        return self.request("DELETE", url, **kw)


@pytest.fixture()
def client(monkeypatch):
    from app import main
    from app.deps import require_admin
    from app.routers import agents as agents_router, checkout as checkout_router, requests as requests_router

    db = FakeDB()

    async def fake_get_db():
        return db

    for mod in (agents_router, checkout_router, requests_router, main):
        monkeypatch.setattr(mod, "get_db", fake_get_db)
    main.app.dependency_overrides[require_admin] = lambda: {"id": "u1", "email": "owner@toyingidea.com", "is_admin": True}
    main.app.router.on_startup.clear()
    main.app.router.on_shutdown.clear()
    c = SyncClient(main.app)
    c.db = db  # type: ignore[attr-defined]
    yield c
    main.app.dependency_overrides.clear()


def test_overview_agents_workflows(client):
    r = client.get("/api/admin/agent-os/overview")
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["agents"]) == 6 and body["pending_actions"] == 0 and body["api_key_configured"] is False

    r = client.get("/api/admin/agent-os/agents")
    assert r.status_code == 200
    oc = next(a for a in r.json()["agents"] if a["key"] == "order_customer")
    assert any(t["risk"] == "action" for t in oc["tool_details"])

    r = client.get("/api/admin/agent-os/workflows")
    assert len(r.json()["workflows"]) == 7


def test_agent_patch_validation(client):
    r = client.patch("/api/admin/agent-os/agents/order_customer", json={"auto_approve_tools": ["get_order"]})
    assert r.status_code == 400
    r = client.patch("/api/admin/agent-os/agents/order_customer", json={"auto_approve_tools": ["update_order_status"], "model": "claude-opus-5-5"})
    assert r.status_code == 200 and r.json()["model"] == "claude-opus-5-5"
    r = client.patch("/api/admin/agent-os/agents/content", json={"model": "gpt-9"})
    assert r.status_code == 400


def test_workflow_crud(client):
    r = client.post("/api/admin/agent-os/workflows", json={"name": "x", "agent": "content", "instruction": "do", "trigger": {"type": "event", "event": "nope"}})
    assert r.status_code == 400
    r = client.post("/api/admin/agent-os/workflows", json={
        "name": "Hourly DM sweep", "agent": "order_customer", "instruction": "Check inbox",
        "trigger": {"type": "schedule", "every": "interval", "interval_minutes": 60}})
    assert r.status_code == 201, r.text
    wid = r.json()["id"]
    assert r.json()["next_run_at"]
    r = client.patch(f"/api/admin/agent-os/workflows/{wid}", json={"enabled": False})
    assert r.status_code == 200 and r.json()["enabled"] is False
    r = client.delete(f"/api/admin/agent-os/workflows/{wid}")
    assert r.status_code == 204


def test_checkout_emits_event_and_creates_customer(client):
    db = client.db
    asyncio.run(db["products"].insert_one({
        "slug": "orbit-dino", "name": "Orbit Dino", "active": True,
        "variants": [{"id": "m", "label": "M", "price": {"currency": "INR", "amount": 799}}]}))
    asyncio.run(db["carts"].insert_one({"session_id": "s1", "items": [{"productSlug": "orbit-dino", "variantId": "m", "quantity": 1}]}))
    client.cookies.set("ti_session", "s1")
    r = client.post("/api/checkout", json={"customer": {"name": "Asha", "email": "Asha@Example.com", "address1": "a", "city": "c", "state": "s", "postalCode": "1"}})
    assert r.status_code == 201, r.text
    assert asyncio.run(db["events"].count_documents({"type": "order.created"})) == 1
    cust = asyncio.run(db["customers"].find_one({"email": "asha@example.com"}))
    assert cust and cust["order_count"] == 1 and cust["lifetime_value"] == 799


def test_request_emits_event(client):
    r = client.post("/api/requests/gifting", json={"occasion": "Diwali", "message": "50 keychains", "quantityRange": "50-100", "email": "a@b.c", "name": "A"})
    assert r.status_code == 200
    assert asyncio.run(client.db["events"].count_documents({"type": "request.created"})) == 1


def test_run_endpoint_and_settings(client):
    r = client.patch("/api/admin/agent-os/settings", json={"paused": True})
    assert r.status_code == 200 and r.json()["paused"] is True
    r = client.post("/api/admin/agent-os/agents/nope/run", json={"task": "hello"})
    assert r.status_code == 400
    r = client.get("/api/admin/agent-os/actions")
    assert r.status_code == 200 and r.json()["actions"] == []
    r = client.get("/api/admin/agent-os/data/insights")
    assert r.status_code == 200
