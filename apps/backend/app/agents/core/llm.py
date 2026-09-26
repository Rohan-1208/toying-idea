"""Minimal Claude Messages API client (httpx, no SDK dependency).

The runtime only depends on the `LLMClient` protocol, so tests can plug in a
scripted fake and the provider can be swapped later.
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

API_URL = os.getenv("ANTHROPIC_API_URL", "https://api.anthropic.com/v1/messages")
API_VERSION = "2023-06-01"

# USD per million tokens (input, output). Used for cost reporting only.
PRICES: dict[str, tuple[float, float]] = {
    "claude-fable-5-1": (10.0, 50.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
}

AVAILABLE_MODELS = [
    {"id": "claude-haiku-4-5", "label": "Claude Haiku 4.5 (fast, cheapest)"},
    {"id": "claude-sonnet-5", "label": "Claude Sonnet 5 (balanced)"},
    {"id": "claude-opus-5-5", "label": "Claude Opus 5.5 (strongest everyday)"},
    {"id": "claude-fable-5-1", "label": "Claude Fable 5.1 (deep reasoning, expensive)"},
]


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    pin, pout = PRICES.get(model, (2.0, 10.0))
    return round((input_tokens * pin + output_tokens * pout) / 1_000_000, 6)


@dataclass
class LLMResponse:
    content: list[dict]
    stop_reason: str
    input_tokens: int = 0
    output_tokens: int = 0
    raw: dict = field(default_factory=dict)


class LLMClient(Protocol):
    async def create(
        self, *, model: str, system: str, messages: list[dict], tools: list[dict], max_tokens: int
    ) -> LLMResponse: ...


class LLMError(Exception):
    pass


class AnthropicClient:
    def __init__(self, api_key: str | None = None, timeout: float = 120.0, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.timeout = timeout
        self.transport = transport  # injectable for tests

    async def create(
        self, *, model: str, system: str, messages: list[dict], tools: list[dict], max_tokens: int = 4096
    ) -> LLMResponse:
        if not self.api_key:
            raise LLMError("ANTHROPIC_API_KEY is not set on the backend. Add it to the Railway variables.")
        body: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
        }
        if tools:
            body["tools"] = tools
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": API_VERSION,
            "content-type": "application/json",
        }
        last_err: Exception | None = None
        for attempt in range(4):
            try:
                async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
                    res = await client.post(API_URL, json=body, headers=headers)
                if res.status_code in (429, 500, 502, 503, 529):
                    last_err = LLMError(f"Claude API {res.status_code}: {res.text[:300]}")
                    await asyncio.sleep(2 ** attempt)
                    continue
                if res.status_code >= 400:
                    raise LLMError(f"Claude API {res.status_code}: {res.text[:500]}")
                data = res.json()
                usage = data.get("usage") or {}
                return LLMResponse(
                    content=data.get("content") or [],
                    stop_reason=data.get("stop_reason") or "end_turn",
                    input_tokens=int(usage.get("input_tokens") or 0),
                    output_tokens=int(usage.get("output_tokens") or 0),
                    raw={"id": data.get("id"), "model": data.get("model")},
                )
            except httpx.HTTPError as e:
                last_err = e
                await asyncio.sleep(2 ** attempt)
        raise LLMError(f"Claude API unavailable after retries: {last_err}")


_default_client: LLMClient | None = None


def get_llm() -> LLMClient:
    global _default_client
    if _default_client is None:
        _default_client = AnthropicClient()
    return _default_client


def set_llm(client: LLMClient | None) -> None:
    """Override the LLM client (tests)."""
    global _default_client
    _default_client = client
