# Toying Idea Agent OS

An AI operating layer inside the existing backend. Six Claude-powered agents do the
operational work; consequential actions wait for your approval in the dashboard at
**`/admin/agents`**.

```
Event / schedule ──► Workflow ──► Agent (Claude tool-use loop) ──► read / draft tools ──► MongoDB
                                         │
                                         └──► action tools ──► Approval queue ──► you approve ──► Executor
```

## Agents

| Key | Agent | Default model | Owns |
| --- | --- | --- | --- |
| `orchestrator` | Orchestrator | claude-haiku-4-5 | Routes any request, delegates to specialists |
| `order_customer` | Order & Customer | claude-sonnet-5 | Orders, customers, custom requests, inventory, messages |
| `product_launch` | Product Launch | claude-sonnet-5 | Photo/idea → priced, SKU'd draft listing → publish |
| `content` | Content | claude-sonnet-5 | Instagram posts, captions, reels, campaigns |
| `design_3d` | 3D Design | claude-opus-5-5 | Design briefs, parametric Blender scripts, render jobs |
| `intelligence` | Product Intelligence | claude-sonnet-5 | Sales/request/stock analysis, recommendations |

Models, on/off, standing instructions and auto-approve rules are editable per agent in the dashboard.

## Tool risk tiers

* **read** – look-ups, run immediately.
* **draft** – internal drafts (messages, content, draft products, notes), run immediately, never customer-facing.
* **action** – consequential (send message, change order/request status, adjust stock, publish product,
  change price, schedule post, run Blender job). Queued for approval unless the tool is on the agent's
  auto-approve list. Every action is validated before it is queued and executed exactly as approved.

## Default workflows (seeded on first boot, editable)

| Workflow | Trigger | Agent |
| --- | --- | --- |
| New order intake | `order.created` (checkout) | Order & Customer |
| Gifting & PYOT request triage | `request.created` | Order & Customer |
| Daily business brief | Daily 08:00 IST | Product Intelligence |
| Stuck order check | Daily 10:30 IST | Order & Customer |
| Weekly content plan | Monday 09:00 IST | Content |
| Weekly product opportunities | Friday 18:00 IST | Product Intelligence |
| Launch → content follow-up (off) | `product.published` | Content |

## Code map

```
apps/backend/app/agents/
  core/        store (collections), tools (registry + risk tiers), llm (Claude API client),
               runtime (agent loop + audit), actions (approval/executor), events, workflows,
               worker (background loop), config (settings + per-agent config)
  tools/       commerce, catalog, content, design, intelligence, orchestration
  definitions/ registry.py – the six agents (prompts, tool allowlists, defaults)
  integrations/channels.py – outbound email (Resend); Instagram/WhatsApp in Phase 2
  service.py   startup/shutdown hooks
apps/backend/app/routers/agents.py  – admin API under /api/admin/agent-os/*
apps/backend/tests/                 – end-to-end tests (in-memory DB + scripted Claude)
apps/storefront/src/app/admin/agents – the dashboard
```

## Collections added

`customers, inventory, inventory_movements, messages, content, assets, insights,
agents, workflows, agent_settings, agent_runs, agent_actions, events`

## Environment variables (backend / Railway)

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Claude API key for all agents |
| `MONGODB_URI`, `MONGODB_DB` | yes (existing) | Central database |
| `AGENT_WORKER` | no (default `1`) | `0` disables the background worker |
| `AGENT_WORKER_INTERVAL` | no (default `20`) | Seconds between worker ticks |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | optional | Send approved emails automatically; without them approved messages are marked *ready to send* for manual copy |

## Running tests

```bash
cd apps/backend
pip install -r requirements.txt pytest
python -m pytest -q tests
```

## Roadmap

1. **Core OS (this phase)** – runtime, six agents on internal data, workflows, approvals, audit, dashboard.
2. **Customer channels** – Instagram Messaging API webhook (`message.received`), email, Shiprocket tracking, Agent OS MCP server.
3. **Content publishing** – Instagram Content Publishing API, product-shot generation, engagement sync.
4. **3D pipeline** – local Blender worker executing queued `blender_script` jobs, STL/3MF + render upload.
5. **Autonomy tuning** – auto-approve by track record, cost dashboards, agent evals.
