"""Agent runtime: runs one agent's Claude tool-use loop and records everything.

Run lifecycle (agent_runs.status):
    queued -> running -> completed | failed | max_steps
    queued -> skipped (paused, agent disabled, budget exhausted)
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Any

from .actions import create_action, execute_action
from .config import get_agent_config, get_settings
from .llm import LLMClient, LLMError, estimate_cost_usd, get_llm
from .store import ACTIONS, RUNS, clean, now_iso, start_of_utc_day_iso, uid
from .tools import ToolContext, ToolError, registry

log = logging.getLogger("agent_os")

MAX_DEPTH = 2
MAX_TOOL_RESULT_CHARS = 12000
_background: set[asyncio.Task] = set()  # keep strong refs so background runs aren't GC'd

BASE_SYSTEM = """You are an operations agent inside the Toying Idea Agent OS.
Toying Idea is an Indian brand that designs and 3D-prints premium toys, collectibles and customised gifts,
sold on its own website (toying idea storefront) and via Instagram. Prices are in INR.

How you work:
- You can only see and change business data through your tools. Never invent order numbers, prices, stock or customer details: look them up.
- Tools marked as requiring approval do NOT take effect immediately. They go to the owner's approval queue. When you get
  back `pending_approval`, treat it as done from your side, do not call it again, and mention it in your final summary.
- Draft tools save internal drafts only; nothing is sent to customers or published until an approval-gated action runs.
- Prefer a few precise tool calls over many broad ones. Stop when the task is done.
- Finish with a short plain-text summary for the owner: what you found, what you drafted, which actions await approval,
  and anything that needs a human decision. Use bullet points. No preamble.
"""


def _text_of(content: list[dict]) -> str:
    return "\n".join(b.get("text", "") for b in content if b.get("type") == "text").strip()


def _truncate(obj: Any) -> str:
    s = json.dumps(clean(obj), ensure_ascii=False, default=str)
    if len(s) > MAX_TOOL_RESULT_CHARS:
        s = s[:MAX_TOOL_RESULT_CHARS] + '... [truncated]"'
    return s


async def _image_blocks(db, attachments: list[dict] | None) -> list[dict]:
    blocks: list[dict] = []
    for a in attachments or []:
        try:
            if a.get("url", "").startswith("http"):
                blocks.append({"type": "image", "source": {"type": "url", "url": a["url"]}})
            elif a.get("upload_id") or a.get("url", "").startswith("/api/uploads/"):
                upload_id = a.get("upload_id") or a["url"].rsplit("/", 1)[-1]
                from motor.motor_asyncio import AsyncIOMotorGridFSBucket
                from bson import ObjectId

                bucket = AsyncIOMotorGridFSBucket(db)
                stream = await bucket.open_download_stream(ObjectId(upload_id))
                data = await stream.read()
                media = (stream.metadata or {}).get("contentType") or "image/jpeg"
                blocks.append(
                    {"type": "image", "source": {"type": "base64", "media_type": media, "data": base64.b64encode(data).decode()}}
                )
        except Exception as e:  # attachment problems should not kill the run
            log.warning("attachment load failed: %s", e)
    return blocks


class AgentRuntime:
    def __init__(self, db, llm: LLMClient | None = None) -> None:
        self.db = db
        self.llm = llm or get_llm()

    # ------------------------------------------------------------------ runs
    async def create_run(
        self,
        agent: str,
        task: str,
        *,
        trigger: dict | None = None,
        attachments: list[dict] | None = None,
        parent_run_id: str | None = None,
        depth: int = 0,
    ) -> str:
        from ..definitions.registry import AGENT_DEFS

        if agent not in AGENT_DEFS:
            raise ToolError(f"Unknown agent '{agent}'")
        run = {
            "_id": uid("run"),
            "agent": agent,
            "task": task,
            "trigger": trigger or {"type": "manual"},
            "attachments": attachments or [],
            "parent_run_id": parent_run_id,
            "depth": depth,
            "status": "queued",
            "created_at": now_iso(),
            "started_at": None,
            "finished_at": None,
            "model": None,
            "steps": [],
            "action_ids": [],
            "child_run_ids": [],
            "output": None,
            "error": None,
            "usage": {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "llm_calls": 0},
        }
        await self.db[RUNS].insert_one(run)
        if parent_run_id:
            await self.db[RUNS].update_one({"_id": parent_run_id}, {"$push": {"child_run_ids": run["_id"]}})
        return run["_id"]

    async def run(self, agent: str, task: str, **kw) -> dict:
        """Create and execute synchronously (used by delegate, tests, workflows)."""
        run_id = await self.create_run(agent, task, **kw)
        return await self.execute(run_id)

    def kick(self, run_id: str) -> None:
        """Execute a queued run in the background (fire-and-forget)."""
        task = asyncio.get_event_loop().create_task(self._safe_execute(run_id))
        _background.add(task)
        task.add_done_callback(_background.discard)

    async def _safe_execute(self, run_id: str) -> None:
        try:
            await self.execute(run_id)
        except Exception:  # pragma: no cover
            log.exception("run %s crashed", run_id)

    async def _finish(self, run_id: str, **fields) -> dict:
        fields.setdefault("finished_at", now_iso())
        await self.db[RUNS].update_one({"_id": run_id}, {"$set": fields})
        doc = await self.db[RUNS].find_one({"_id": run_id})
        try:
            from .events import emit_event

            await emit_event(
                self.db,
                "run.finished",
                {"run_id": run_id, "agent": doc.get("agent"), "status": doc.get("status")},
                source="runtime",
            )
        except Exception:
            pass
        return clean(doc)

    async def execute(self, run_id: str) -> dict:
        db = self.db
        run = await db[RUNS].find_one_and_update(
            {"_id": run_id, "status": "queued"},
            {"$set": {"status": "running", "started_at": now_iso()}},
            return_document=True,
        )
        if not run:
            return clean(await db[RUNS].find_one({"_id": run_id}))

        settings = await get_settings(db)
        cfg = await get_agent_config(db, run["agent"])

        if settings.get("paused"):
            return await self._finish(run_id, status="skipped", error="Agent OS is paused")
        if not cfg["enabled"]:
            return await self._finish(run_id, status="skipped", error=f"Agent {cfg['name']} is disabled")
        if run.get("depth", 0) == 0:
            today = await db[RUNS].count_documents({"created_at": {"$gte": start_of_utc_day_iso()}, "depth": 0})
            if today > int(settings.get("daily_run_budget") or 200):
                return await self._finish(run_id, status="skipped", error="Daily run budget exhausted")

        try:
            return await self._loop(run, cfg, settings)
        except LLMError as e:
            return await self._finish(run_id, status="failed", error=str(e))
        except Exception as e:
            log.exception("run failed")
            return await self._finish(run_id, status="failed", error=f"{type(e).__name__}: {e}", trace=traceback.format_exc()[-3000:])

    # ------------------------------------------------------------------ loop
    def _system_prompt(self, agent_def, cfg: dict, settings: dict) -> str:
        biz = settings.get("business") or {}
        offset = int(settings.get("utc_offset_minutes") or 330)
        from datetime import timedelta

        local = datetime.now(timezone.utc) + timedelta(minutes=offset)
        parts = [
            BASE_SYSTEM,
            f"Current local date/time: {local.strftime('%A %d %B %Y, %H:%M')} (UTC{offset/60:+.1f}).",
            f"Brand voice: {biz.get('tone', '')}. Lead times: {biz.get('production_lead_days', '')}.",
            f"\n# Your role: {agent_def.name}\n{agent_def.system_prompt.strip()}",
        ]
        if cfg.get("instructions"):
            parts.append(f"\n# Owner's standing instructions (follow these)\n{cfg['instructions'].strip()}")
        return "\n".join(parts)

    async def _loop(self, run: dict, cfg: dict, settings: dict) -> dict:
        from ..definitions.registry import AGENT_DEFS

        db = self.db
        run_id = run["_id"]
        agent_def = AGENT_DEFS[run["agent"]]
        model = cfg["model"]
        max_steps = int(settings.get("max_steps") or 12)
        tools = [registry.get(n) for n in agent_def.tools]
        tools = [t for t in tools if t is not None]
        tool_schemas = [t.api_schema() for t in tools]
        allowed = {t.name for t in tools}
        system = self._system_prompt(agent_def, cfg, settings)

        user_content: list[dict] = await _image_blocks(db, run.get("attachments"))
        user_content.append({"type": "text", "text": run["task"]})
        messages: list[dict] = [{"role": "user", "content": user_content}]

        usage = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "llm_calls": 0}
        steps: list[dict] = []
        await db[RUNS].update_one({"_id": run_id}, {"$set": {"model": model}})

        final_text = ""
        status = "max_steps"
        for step_no in range(max_steps):
            resp = await self.llm.create(model=model, system=system, messages=messages, tools=tool_schemas, max_tokens=4096)
            usage["input_tokens"] += resp.input_tokens
            usage["output_tokens"] += resp.output_tokens
            usage["llm_calls"] += 1
            usage["cost_usd"] = estimate_cost_usd(model, usage["input_tokens"], usage["output_tokens"])
            messages.append({"role": "assistant", "content": resp.content})

            thought = _text_of(resp.content)
            if thought:
                steps.append({"type": "message", "at": now_iso(), "text": thought[:4000]})

            tool_uses = [b for b in resp.content if b.get("type") == "tool_use"]
            if resp.stop_reason != "tool_use" or not tool_uses:
                final_text = thought
                status = "completed"
                await db[RUNS].update_one({"_id": run_id}, {"$set": {"steps": steps, "usage": usage}})
                break

            results = []
            for tu in tool_uses:
                result, is_error, step = await self._call_tool(run, cfg, tu, allowed)
                steps.append(step)
                results.append(
                    {"type": "tool_result", "tool_use_id": tu["id"], "content": _truncate(result), "is_error": is_error}
                )
            messages.append({"role": "user", "content": results})
            await db[RUNS].update_one({"_id": run_id}, {"$set": {"steps": steps, "usage": usage}})

        if status == "max_steps":
            final_text = final_text or "Stopped: reached the maximum number of steps for one run."

        return await self._finish(run_id, status=status, output=final_text, steps=steps, usage=usage)

    async def _call_tool(self, run: dict, cfg: dict, tu: dict, allowed: set[str]) -> tuple[Any, bool, dict]:
        name = tu.get("name")
        args = dict(tu.get("input") or {})
        step = {"type": "tool", "at": now_iso(), "tool": name, "input": clean(args)}
        t = registry.get(name)
        if t is None or name not in allowed:
            step.update(status="error", output={"error": "tool not available"})
            return {"error": f"Tool {name} is not available to you."}, True, step
        step["risk"] = t.risk
        ctx = ToolContext(db=self.db, agent=run["agent"], run_id=run["_id"], depth=run.get("depth", 0), runtime=self)

        try:
            if t.risk in ("read", "draft"):
                out = await t.handler(ctx, **args)
                step.update(status="ok", output=clean(out))
                return out, False, step

            # --- action: validate, then queue or auto-execute
            reason = str(args.pop("reason", "") or "")
            if t.validate:
                await t.validate(ctx, **args)
            action = await create_action(self.db, agent=run["agent"], tool_name=name, args=args, reason=reason, run_id=run["_id"])
            if name in (cfg.get("auto_approve_tools") or []):
                await self.db[ACTIONS].update_one(
                    {"_id": action["_id"]},
                    {"$set": {"status": "approved", "decided_by": "auto-policy", "decided_at": now_iso()}},
                )
                done = await execute_action(self.db, action["_id"], actor="auto-policy")
                out = {"status": done.get("status"), "action_id": action["_id"], "result": done.get("result"), "error": done.get("error")}
                step.update(status="auto_executed", action_id=action["_id"], output=clean(out))
                return out, done.get("status") != "executed", step
            out = {
                "status": "pending_approval",
                "action_id": action["_id"],
                "message": "Queued for the owner's approval. Do not call this again; carry on and mention it in your summary.",
            }
            step.update(status="pending_approval", action_id=action["_id"], output=out)
            return out, False, step
        except ToolError as e:
            step.update(status="error", output={"error": str(e)})
            return {"error": str(e)}, True, step
        except TypeError as e:
            step.update(status="error", output={"error": f"bad arguments: {e}"})
            return {"error": f"Bad arguments for {name}: {e}"}, True, step
        except Exception as e:
            log.exception("tool %s failed", name)
            step.update(status="error", output={"error": f"{type(e).__name__}: {e}"})
            return {"error": f"Tool failed: {type(e).__name__}: {e}"}, True, step
