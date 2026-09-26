"""Orchestrator tools: discover agents and delegate work to them."""
from __future__ import annotations

from ..core.config import get_agent_config
from ..core.tools import ToolContext, ToolError, tool


@tool(
    "list_agents",
    "List the specialist agents, what they own, and whether they are enabled.",
    {"type": "object", "properties": {}},
    label="List agents",
)
async def list_agents(ctx: ToolContext) -> dict:
    from ..definitions.registry import AGENT_DEFS

    out = []
    for key, d in AGENT_DEFS.items():
        if key == "orchestrator":
            continue
        cfg = await get_agent_config(ctx.db, key)
        out.append({"agent": key, "name": d.name, "owns": d.description, "enabled": cfg["enabled"]})
    return {"agents": out}


@tool(
    "delegate_to_agent",
    "Hand a clear, self-contained task to a specialist agent and wait for its summary. Include every detail it needs "
    "(order numbers, product names, constraints). Its consequential actions still go to the owner's approval queue.",
    {
        "type": "object",
        "properties": {
            "agent": {"type": "string", "enum": ["order_customer", "product_launch", "content", "design_3d", "intelligence"]},
            "task": {"type": "string"},
        },
        "required": ["agent", "task"],
    },
    label="Delegate to agent",
)
async def delegate_to_agent(ctx: ToolContext, agent: str, task: str) -> dict:
    from ..core.runtime import MAX_DEPTH

    if ctx.runtime is None:
        raise ToolError("Delegation unavailable outside a run")
    if ctx.depth + 1 > MAX_DEPTH:
        raise ToolError("Delegation depth limit reached; do the work yourself or summarise.")
    if agent == ctx.agent:
        raise ToolError("Cannot delegate to yourself")
    child = await ctx.runtime.run(
        agent,
        task,
        trigger={"type": "delegation", "from_agent": ctx.agent, "parent_run_id": ctx.run_id},
        parent_run_id=ctx.run_id,
        depth=ctx.depth + 1,
    )
    return {
        "agent": agent,
        "run_id": child.get("id"),
        "status": child.get("status"),
        "summary": child.get("output") or child.get("error"),
        "pending_action_ids": child.get("action_ids") or [],
    }
