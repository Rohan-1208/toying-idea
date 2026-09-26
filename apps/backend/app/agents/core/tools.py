"""Tool definitions and the global tool registry.

Every capability an agent has is a Tool. Tools are the ONLY way agents read or
change business data, which is what makes every agent action auditable and
approvable.

Risk tiers
----------
read    -> runs immediately, no side effects.
draft   -> runs immediately, writes internal drafts only (never customer-facing,
           never money/stock, never public).
action  -> consequential. Creates a pending approval unless the agent has the
           tool on its auto-approve list. Executed later by the executor.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

Risk = Literal["read", "draft", "action"]


@dataclass
class ToolContext:
    db: Any
    agent: str
    run_id: str | None = None
    depth: int = 0
    runtime: Any = None  # AgentRuntime, used by delegate tool
    actor: str = "agent"  # "agent" | "human:<email>" | "auto-policy"


Handler = Callable[..., Awaitable[Any]]


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Handler
    risk: Risk = "read"
    # Short human label for the approval card, e.g. "Update order status".
    label: str = ""
    # Optional function(args) -> one-line human summary for approval cards.
    summarize: Callable[[dict], str] | None = None
    # Optional async validate(ctx, args) raising ToolError. Runs BEFORE an action is
    # queued so the agent gets immediate feedback on bad arguments.
    validate: Handler | None = None
    tags: list[str] = field(default_factory=list)

    def api_schema(self) -> dict:
        schema = copy.deepcopy(self.input_schema) or {"type": "object", "properties": {}}
        schema.setdefault("type", "object")
        schema.setdefault("properties", {})
        if self.risk == "action":
            # Action tools must explain themselves to the human approver.
            schema["properties"]["reason"] = {
                "type": "string",
                "description": "One or two sentences for the human approver: why this action is needed.",
            }
            req = list(schema.get("required") or [])
            if "reason" not in req:
                req.append("reason")
            schema["required"] = req
        desc = self.description
        if self.risk == "action":
            desc += " (Requires human approval unless auto-approved; you will get an action_id back.)"
        return {"name": self.name, "description": desc, "input_schema": schema}

    def summary(self, args: dict) -> str:
        if self.summarize:
            try:
                return self.summarize(args)
            except Exception:
                pass
        shown = {k: v for k, v in args.items() if k != "reason"}
        text = ", ".join(f"{k}={v!r}" for k, v in list(shown.items())[:4])
        return f"{self.label or self.name}: {text}"[:300]


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> Tool:
        if tool.name in self._tools:
            raise ValueError(f"Duplicate tool {tool.name}")
        self._tools[tool.name] = tool
        return tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def all(self) -> list[Tool]:
        return list(self._tools.values())

    def describe(self) -> list[dict]:
        return [
            {"name": t.name, "label": t.label or t.name, "risk": t.risk, "description": t.description}
            for t in self._tools.values()
        ]


registry = ToolRegistry()


def tool(
    name: str,
    description: str,
    schema: dict | None = None,
    *,
    risk: Risk = "read",
    label: str = "",
    summarize: Callable[[dict], str] | None = None,
    validate: Handler | None = None,
):
    """Decorator: register an async function(ctx, **args) as a tool."""

    def deco(fn: Handler) -> Handler:
        registry.register(
            Tool(
                name=name,
                description=description,
                input_schema=schema or {"type": "object", "properties": {}},
                handler=fn,
                risk=risk,
                label=label,
                summarize=summarize,
                validate=validate,
            )
        )
        return fn

    return deco


class ToolError(Exception):
    """Raised by a tool for an expected, model-facing error (bad input, not found)."""
