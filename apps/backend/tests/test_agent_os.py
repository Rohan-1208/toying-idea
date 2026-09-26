"""End-to-end tests for the Agent OS with an in-memory DB and a scripted Claude."""
from __future__ import annotations

import asyncio
import itertools
from datetime import datetime, timezone

import pytest

from tests.fake_mongo import FakeDB

from app.agents.core import config as cfgmod
from app.agents.core.actions import approve_action, reject_action
from app.agents.core.llm import LLMResponse, set_llm
from app.agents.core.runtime import AgentRuntime
from app.agents.core.store import ACTIONS, CUSTOMERS, EVENTS, MESSAGES, ORDERS, PRODUCTS, RUNS, WORKFLOWS
from app.agents.core.worker import tick
from app.agents.core.workflows import compute_next_run, run_due_schedules, seed_workflows
from app.agents.definitions.registry import AGENT_DEFS
from app.agents.tools.catalog import compute_price

_ids = itertools.count(1)


def tu(tool_name, **inp):
    return {"type": "tool_use", "id": f"tu_{next(_ids)}", "name": tool_name, "input": inp}


def text(t):
    return {"type": "text", "text": t}


class ScriptedLLM:
    """Returns scripted responses per agent (matched on the role name in the system prompt)."""

    def __init__(self, scripts: dict[str, list[list[dict]]]):
        self.scripts = {k: list(v) for k, v in scripts.items()}
        self.calls: list[dict] = []

    async def create(self, *, model, system, messages, tools, max_tokens):
        agent = next(k for k, d in AGENT_DEFS.items() if f"# Your role: {d.name}" in system)
        self.calls.append({"agent": agent, "model": model, "messages": messages, "tools": [t["name"] for t in tools]})
        queue = self.scripts.get(agent) or []
        content = queue.pop(0) if queue else [text("Done.")]
        stop = "tool_use" if any(b["type"] == "tool_use" for b in content) else "end_turn"
        return LLMResponse(content=content, stop_reason=stop, input_tokens=1000, output_tokens=200)


def run(coro):
    return asyncio.run(coro)


def seed_order(db, number="TI-1001", status="Placed"):
    order = {
        "number": number, "createdAt": datetime.now(timezone.utc).isoformat(), "status": status,
        "customer": {"name": "Asha Rao", "email": "asha@example.com", "phone": "999", "address1": "1 MG Road",
                     "city": "Bengaluru", "state": "KA", "postalCode": "560001", "country": "IN"},
        "items": [{"productSlug": "orbit-dino", "variantId": "m-teal", "quantity": 2, "name": "Orbit Dino",
                   "variantLabel": "Medium / Teal", "unitPrice": {"currency": "INR", "amount": 799}}],
        "events": [{"id": "e1", "at": "x", "title": "Order placed"}],
    }
    return db[ORDERS].insert_one(order)


def seed_product(db):
    return db[PRODUCTS].insert_one({
        "slug": "orbit-dino", "name": "Orbit Dino", "tagline": "A dino in orbit", "description": "d",
        "categories": ["Dinos"], "active": True,
        "variants": [{"id": "m-teal", "label": "Medium / Teal", "material": "PLA", "finish": "Matte", "size": "M",
                      "price": {"currency": "INR", "amount": 799}}],
    })


# ---------------------------------------------------------------------------- tests
def test_all_agents_reference_registered_tools():
    assert set(AGENT_DEFS) == {"orchestrator", "order_customer", "product_launch", "content", "design_3d", "intelligence"}


def test_order_intake_workflow_end_to_end():
    async def go():
        db = FakeDB()
        await seed_product(db)
        await seed_order(db)
        await seed_workflows(db)
        assert await db[WORKFLOWS].count_documents({}) == 7
        llm = ScriptedLLM({"order_customer": [
            [text("Looking up the order."), tu("get_order", order_number="TI-1001"), tu("check_stock", order_number="TI-1001")],
            [tu("draft_customer_message", channel="email", to="asha@example.com", subject="Your order TI-1001",
                body="Hi Asha, thanks!", order_number="TI-1001")],
            [tu("send_customer_message", message_id="__MSG__", reason="Confirm the order"),
             tu("update_order_status", order_number="TI-1001", status="In production", customer_note="Printing now",
                reason="All items are made to order")],
            [text("- Drafted confirmation\n- 2 actions await approval")],
        ]})

        # patch message id once it exists
        orig = llm.create

        async def create(**kw):
            resp = await orig(**kw)
            for b in resp.content:
                if b.get("name") == "send_customer_message":
                    m = await db[MESSAGES].find_one({})
                    b["input"]["message_id"] = m["_id"]
            return resp

        llm.create = create  # type: ignore
        rt = AgentRuntime(db, llm)

        from app.agents.core.events import emit_event
        await emit_event(db, "order.created", {"order_number": "TI-1001"})
        res = await tick(db, rt, execute_inline=True)
        assert len(res["started"]) == 1
        r = await db[RUNS].find_one({"_id": res["started"][0]})
        assert r["status"] == "completed", r.get("error")
        assert r["trigger"]["event"] == "order.created"
        assert "TI-1001" in r["task"]
        assert r["usage"]["llm_calls"] == 4 and r["usage"]["cost_usd"] > 0
        pending = await db[ACTIONS].find({"status": "pending"}).to_list(10)
        assert {a["tool"] for a in pending} == {"send_customer_message", "update_order_status"}
        assert all(a["reason"] for a in pending)
        # order unchanged until approval
        assert (await db[ORDERS].find_one({"number": "TI-1001"}))["status"] == "Placed"

        status_action = next(a for a in pending if a["tool"] == "update_order_status")
        done = await approve_action(db, status_action["_id"], by="human:owner")
        assert done["status"] == "executed"
        o = await db[ORDERS].find_one({"number": "TI-1001"})
        assert o["status"] == "In production" and o["events"][-1]["description"] == "Printing now"
        assert await db[EVENTS].count_documents({"type": "order.status_changed"}) == 1

        msg_action = next(a for a in pending if a["tool"] == "send_customer_message")
        done = await approve_action(db, msg_action["_id"], by="human:owner")
        assert done["status"] == "executed"
        m = await db[MESSAGES].find_one({})
        assert m["status"] == "ready_to_send"  # no email provider configured in tests

        # double approval is refused
        with pytest.raises(Exception):
            await approve_action(db, msg_action["_id"], by="human:owner")

    run(go())


def test_auto_approve_and_validation():
    async def go():
        db = FakeDB()
        await seed_product(db)
        await seed_order(db)
        await cfgmod.update_agent_config(db, "order_customer", {"auto_approve_tools": ["update_order_status"]})
        llm = ScriptedLLM({"order_customer": [
            [tu("update_order_status", order_number="TI-1001", status="Teleported", reason="x")],
            [tu("update_order_status", order_number="TI-9999", status="Shipped", reason="x")],
            [tu("update_order_status", order_number="TI-1001", status="In production", reason="ok"), tu("delete_everything")],
            [text("done")],
        ]})
        rt = AgentRuntime(db, llm)
        out = await rt.run("order_customer", "move it")
        assert out["status"] == "completed"
        steps = [s for s in out["steps"] if s["type"] == "tool"]
        assert steps[0]["status"] == "error" and "Invalid status" in steps[0]["output"]["error"]
        assert steps[1]["status"] == "error" and "not found" in steps[1]["output"]["error"]
        assert steps[2]["status"] == "auto_executed"
        assert steps[3]["status"] == "error"  # tool not in allowlist
        assert (await db[ORDERS].find_one({}))["status"] == "In production"
        a = await db[ACTIONS].find_one({})
        assert a["decided_by"] == "auto-policy" and a["status"] == "executed"
        assert await db[ACTIONS].count_documents({}) == 1  # invalid ones never queued

    run(go())


def test_product_launch_and_publish():
    async def go():
        db = FakeDB()
        await seed_product(db)
        llm = ScriptedLLM({"product_launch": [
            [tu("calculate_price", filament_grams=120, print_hours=6, material="PLA", post_processing_minutes=15),
             tu("generate_sku", category="Animals", name="Owl Lamp", material="PLA", size="M")],
            [tu("create_draft_product", slug="owl-lamp", name="Owl Lamp", tagline="A glowing night owl",
                description="desc", categories=["Decor"],
                variants=[{"id": "m", "sku": "TI-ANIMA-OWLLAMP-PLA-M", "label": "Medium", "material": "PLA",
                           "finish": "Matte", "size": "M", "price_inr": 1249}])],
            [tu("publish_product", slug="owl-lamp", reason="Launch requested")],
            [text("Owl Lamp drafted and awaiting publish approval")],
        ]})
        rt = AgentRuntime(db, llm)
        out = await rt.run("product_launch", "Launch an owl lamp")
        assert out["status"] == "completed"
        price_step = out["steps"][0] if out["steps"][0]["type"] == "tool" else out["steps"][1]
        assert price_step["output"]["suggested_price_inr_incl_gst"] % 50 == 49
        p = await db[PRODUCTS].find_one({"slug": "owl-lamp"})
        assert p["active"] is False and p["draft"] is True
        a = await db[ACTIONS].find_one({"tool": "publish_product"})
        await approve_action(db, a["_id"], by="human:owner")
        p = await db[PRODUCTS].find_one({"slug": "owl-lamp"})
        assert p["active"] is True
        assert await db[EVENTS].count_documents({"type": "product.published"}) == 1

    run(go())


def test_orchestrator_delegates():
    async def go():
        db = FakeDB()
        await seed_product(db)
        llm = ScriptedLLM({
            "orchestrator": [[tu("delegate_to_agent", agent="intelligence", task="Weekly report")], [text("Report saved.")]],
            "intelligence": [
                [tu("sales_summary", days=7), tu("best_sellers", days=30)],
                [tu("save_insight", title="Weekly", kind="analysis", summary="- ok",
                    recommendations=[{"title": "Promote dino", "rationale": "top seller", "priority": "high"}])],
                [text("Saved insight")],
            ],
        })
        rt = AgentRuntime(db, llm)
        out = await rt.run("orchestrator", "How are we doing?")
        assert out["status"] == "completed"
        assert len(out["child_run_ids"]) == 1
        child = await db[RUNS].find_one({"_id": out["child_run_ids"][0]})
        assert child["agent"] == "intelligence" and child["depth"] == 1 and child["status"] == "completed"
        assert await db["insights"].count_documents({}) == 1
        assert llm.calls[0]["model"] == "claude-haiku-4-5"

    run(go())


def test_pause_and_disable_skip_runs():
    async def go():
        db = FakeDB()
        rt = AgentRuntime(db, ScriptedLLM({}))
        await cfgmod.update_settings(db, {"paused": True})
        out = await rt.run("content", "plan")
        assert out["status"] == "skipped"
        await cfgmod.update_settings(db, {"paused": False})
        await cfgmod.update_agent_config(db, "content", {"enabled": False})
        out = await rt.run("content", "plan")
        assert out["status"] == "skipped" and "disabled" in out["error"]

    run(go())


def test_missing_api_key_fails_cleanly():
    async def go():
        db = FakeDB()
        set_llm(None)
        rt = AgentRuntime(db)  # real client, no key
        out = await rt.run("content", "plan")
        assert out["status"] == "failed" and "ANTHROPIC_API_KEY" in out["error"]

    run(go())


def test_schedules():
    ist = 330
    base = datetime(2026, 9, 26, 3, 0, tzinfo=timezone.utc)  # 08:30 IST Saturday
    nxt = compute_next_run({"type": "schedule", "every": "daily", "at": "08:00"}, base, ist)
    assert nxt == datetime(2026, 9, 27, 2, 30, tzinfo=timezone.utc)  # tomorrow 08:00 IST
    nxt = compute_next_run({"type": "schedule", "every": "daily", "at": "10:30"}, base, ist)
    assert nxt == datetime(2026, 9, 26, 5, 0, tzinfo=timezone.utc)
    nxt = compute_next_run({"type": "schedule", "every": "weekly", "weekday": 0, "at": "09:00"}, base, ist)
    assert nxt == datetime(2026, 9, 28, 3, 30, tzinfo=timezone.utc)  # Monday 09:00 IST
    assert compute_next_run({"type": "event", "event": "order.created"}, base, ist) is None

    async def go():
        db = FakeDB()
        await seed_workflows(db)
        await db[WORKFLOWS].update_one({"key": "daily-brief"}, {"$set": {"next_run_at": "2000-01-01T00:00:00+00:00"}})
        rt = AgentRuntime(db, ScriptedLLM({}))
        started = await run_due_schedules(db, rt)
        assert len(started) == 1
        wf = await db[WORKFLOWS].find_one({"key": "daily-brief"})
        assert wf["next_run_at"] > "2026" and wf["run_count"] == 1
        assert await run_due_schedules(db, rt) == []  # not due again

    run(go())


def test_pricing_model():
    pricing = cfgmod.DEFAULT_SETTINGS["pricing"]
    r = compute_price(pricing, filament_grams=100, print_hours=5, material="PLA", post_processing_minutes=10)
    assert r["unit_cost_inr"] > 0
    assert r["suggested_price_inr_incl_gst"] % 50 == 49
    assert 40 <= r["effective_margin_pct"] <= 70


def test_reject_action():
    async def go():
        db = FakeDB()
        await seed_product(db)
        await seed_order(db)
        llm = ScriptedLLM({"order_customer": [[tu("update_order_status", order_number="TI-1001", status="Shipped", reason="r")], [text("ok")]]})
        await AgentRuntime(db, llm).run("order_customer", "ship")
        a = await db[ACTIONS].find_one({})
        await reject_action(db, a["_id"], by="human:owner", note="Not yet")
        assert (await db[ACTIONS].find_one({}))["status"] == "rejected"
        assert (await db[ORDERS].find_one({}))["status"] == "Placed"

    run(go())


def test_anthropic_client_request_shape():
    import json as _json

    import httpx

    from app.agents.core.llm import AnthropicClient

    seen = {}

    def handler(request: httpx.Request):
        seen["headers"] = dict(request.headers)
        seen["body"] = _json.loads(request.content)
        return httpx.Response(200, json={
            "id": "msg_1", "model": "claude-sonnet-5", "stop_reason": "tool_use",
            "content": [{"type": "tool_use", "id": "t1", "name": "get_order", "input": {"order_number": "TI-1"}}],
            "usage": {"input_tokens": 10, "output_tokens": 5}})

    c = AnthropicClient(api_key="k", transport=httpx.MockTransport(handler))
    r = asyncio.run(c.create(model="claude-sonnet-5", system="s", messages=[{"role": "user", "content": "hi"}],
                             tools=[{"name": "get_order", "description": "d", "input_schema": {"type": "object"}}], max_tokens=100))
    assert seen["headers"]["x-api-key"] == "k" and seen["headers"]["anthropic-version"] == "2023-06-01"
    assert seen["body"]["model"] == "claude-sonnet-5" and seen["body"]["tools"][0]["name"] == "get_order"
    assert r.stop_reason == "tool_use" and r.input_tokens == 10
