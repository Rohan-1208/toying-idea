import { getSupabase } from "./supabase.js";

type Doc = Record<string, unknown> & { id: string; kind: string };

const AGENTS = [
  {
    key: "orchestrator",
    name: "Orchestrator",
    role: "Chief of staff",
    description: "Takes any request, splits it into steps and delegates to the right specialist agents.",
    default_model: "claude-haiku-4-5",
    tools: ["list_agents", "delegate_to_agent"],
    prompt: "You coordinate specialists. Do not invent orders or prices. Delegate with a complete task, then summarise what each agent did and what is waiting for approval.",
  },
  {
    key: "order_customer",
    name: "Order & Customer Agent",
    role: "Customer operations",
    description: "Website orders, customer messages, order status, custom requests and inventory.",
    default_model: "claude-sonnet-5",
    tools: ["list_orders", "get_order", "list_inquiries", "draft_customer_message", "update_order_status"],
    prompt: "You run customer operations. Look up the order before you reply. Draft messages; never send them yourself. Propose the next order status only. Do not offer refunds or discounts. Sign drafts as Team Toying Idea.",
  },
  {
    key: "product_launch",
    name: "Product Launch Agent",
    role: "Merchandising",
    description: "Turns a product idea into a priced draft listing for you to approve.",
    default_model: "claude-sonnet-5",
    tools: ["list_products", "get_product", "calculate_price", "create_draft_product"],
    prompt: "Check the catalog for duplicates, price with calculate_price, and save a hidden draft with create_draft_product. Do not publish it.",
  },
  {
    key: "content",
    name: "Content Agent",
    role: "Marketing",
    description: "Plans and drafts Instagram posts, captions, reel scripts and campaigns.",
    default_model: "claude-sonnet-5",
    tools: ["list_products", "best_sellers", "create_content_draft"],
    prompt: "Draft Instagram content for Indian parents, gifters and collectors. Include a first line, short copy, a CTA, hashtags and a visual brief. Save drafts; do not claim they are posted.",
  },
  {
    key: "design_3d",
    name: "3D Design Agent",
    role: "Product design",
    description: "Writes printable design briefs. Rendering runs only after you approve a job.",
    default_model: "claude-opus-5-5",
    tools: ["list_inquiries", "create_design_brief"],
    prompt: "Write an FDM design brief: size, parts, 0.3 mm joint clearance, 1.2 mm walls, supports, colours, estimated grams and hours. Do not recreate trademarked characters. Save the brief.",
  },
  {
    key: "intelligence",
    name: "Product Intelligence Agent",
    role: "Analyst",
    description: "Analyses sales, inquiries and the catalog, then saves a short report.",
    default_model: "claude-sonnet-5",
    tools: ["sales_summary", "list_orders", "list_inquiries", "list_products", "save_insight"],
    prompt: "Every number must come from a tool. Do not over-read one or two orders. Save a report of 3 to 8 bullets with specific next actions.",
  },
] as const;

const MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast, cheapest)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (balanced)" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (strongest everyday)" },
];

const DEFAULT_SETTINGS = {
  paused: false,
  daily_run_budget: 40,
  max_steps: 4,
  utc_offset_minutes: 330,
  low_stock_threshold: 3,
  business: {
    name: "Toying Idea",
    currency: "INR",
    tone: "warm, playful, concise; Indian English; no over-promising on delivery dates",
    production_lead_days: "3-5 working days to print, 2-6 days shipping within India",
  },
  pricing: {
    filament_cost_per_kg: { PLA: 1100, PETG: 1300, TPU: 2200, "Silk PLA": 1500 },
    machine_cost_per_hour: 25,
    labour_cost_per_hour: 150,
    failure_rate: 0.1,
    packaging_cost: 40,
    platform_fee_pct: 2,
    gst_pct: 18,
    default_target_margin_pct: 55,
    round_to: 49,
  },
};

const DEFAULT_WORKFLOWS = [
  { key: "new-order-intake", name: "New order intake", description: "Look up a new order and draft a confirmation.", agent: "order_customer", instruction: "Look up the newest website order, draft a confirmation that states the lead time, and propose the next status only if it is still pending.", trigger: { type: "manual" } },
  { key: "daily-brief", name: "Daily business brief", description: "Orders, revenue and what needs attention.", agent: "intelligence", instruction: "Write today's brief: recent orders and revenue, open inquiries, and the 3 most important things to do. Save it as an insight.", trigger: { type: "schedule", every: "daily", at: "08:00" } },
  { key: "weekly-content-plan", name: "Weekly content plan", description: "Draft the week's Instagram posts from what is selling.", agent: "content", instruction: "Plan 4 posts and 2 reels from current products and recent orders. Save each as a content draft.", trigger: { type: "schedule", every: "weekly", weekday: 0, at: "09:00" } },
];

const ACTION_TOOLS = new Set(["update_order_status", "delegate_to_agent"]);

function sb() {
  return getSupabase();
}

function q1(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] || "" : v || "";
}

async function rows(kind?: string): Promise<Doc[]> {
  const { data, error } = await sb()
    .from("drafts")
    .select("id, payload, created_at")
    .eq("agent", "agent-os")
    .eq("status", "record")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);
  const docs = (data || []).map((row) => {
    const payload = (row.payload || {}) as Record<string, unknown>;
    return { ...payload, kind: String(payload.kind || ""), id: String(row.id) } as Doc;
  });
  return kind ? docs.filter((d) => d.kind === kind) : docs;
}

async function insert(kind: string, payload: Record<string, unknown>): Promise<Doc> {
  const { data, error } = await sb()
    .from("drafts")
    .insert({ agent: "agent-os", status: "record", title: kind, payload: { kind, ...payload } })
    .select("id, payload")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, kind, ...((data.payload as object) || {}) };
}

async function patch(id: string, payload: Record<string, unknown>): Promise<Doc> {
  const { data: cur, error: readErr } = await sb().from("drafts").select("id, payload").eq("id", id).eq("agent", "agent-os").maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!cur) throw new Error("Not found");
  const next = { ...((cur.payload as object) || {}), ...payload };
  const { error } = await sb().from("drafts").update({ payload: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return { id, kind: String((next as { kind?: string }).kind || ""), ...next };
}

async function remove(id: string) {
  const { error } = await sb().from("drafts").delete().eq("id", id).eq("agent", "agent-os");
  if (error) throw new Error(error.message);
}

function agentDef(key: string) {
  return AGENTS.find((a) => a.key === key);
}

async function settings(): Promise<typeof DEFAULT_SETTINGS & { updated_at?: string }> {
  const found = (await rows("settings"))[0];
  return { ...DEFAULT_SETTINGS, ...((found || {}) as object) } as typeof DEFAULT_SETTINGS;
}

async function agentConfig(key: string) {
  const def = agentDef(key);
  if (!def) throw new Error("Unknown agent");
  const saved = (await rows("agent")).find((a) => a.key === key);
  return {
    key,
    name: def.name,
    role: def.role,
    description: def.description,
    enabled: saved?.enabled !== false,
    model: String(saved?.model || def.default_model),
    default_model: def.default_model,
    auto_approve_tools: Array.isArray(saved?.auto_approve_tools) ? saved.auto_approve_tools : [],
    instructions: String(saved?.instructions || ""),
    tools: [...def.tools],
    system_prompt: def.prompt,
  };
}

async function ensureWorkflows() {
  const existing = await rows("workflow");
  if (existing.length) return existing;
  for (const w of DEFAULT_WORKFLOWS) await insert("workflow", { ...w, enabled: true, run_count: 0 });
  return rows("workflow");
}

function price(grams: number, hours: number, material: string, pricing: typeof DEFAULT_SETTINGS.pricing) {
  const perKg = pricing.filament_cost_per_kg[material as keyof typeof pricing.filament_cost_per_kg] || pricing.filament_cost_per_kg.PLA;
  const fail = Number(pricing.failure_rate) || 0;
  const cost = (grams / 1000) * perKg * (1 + fail) + hours * Number(pricing.machine_cost_per_hour) * (1 + fail) + Number(pricing.packaging_cost);
  const margin = Number(pricing.default_target_margin_pct) / 100;
  const gst = Number(pricing.gst_pct) / 100;
  const pre = cost / (1 - margin);
  const incl = Math.ceil((pre * (1 + gst)) / 50) * 50 - 1;
  return { unit_cost_inr: Math.round(cost), suggested_price_inr_incl_gst: incl, material };
}

async function toolCall(name: string, args: Record<string, unknown>, ctx: { agent: string; runId: string }) {
  const client = sb();
  if (name === "list_orders") {
    const { data, error } = await client.from("orders").select("order_number, status, total, currency, customer, created_at").order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return { orders: data };
  }
  if (name === "get_order") {
    const { data, error } = await client.from("orders").select("*").eq("order_number", String(args.order_number || "")).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Order not found");
    return data;
  }
  if (name === "list_products" || name === "best_sellers") {
    const { data, error } = await client.from("products").select("slug, name, price, category, active").eq("active", true).limit(30);
    if (error) throw new Error(error.message);
    return { products: data };
  }
  if (name === "get_product") {
    const { data, error } = await client.from("products").select("slug, name, tagline, description, price, category, active").eq("slug", String(args.slug || "")).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Product not found");
    return data;
  }
  if (name === "list_inquiries") {
    const { data, error } = await client.from("inquiries").select("id, type, name, email, message, status, created_at").order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return { inquiries: data };
  }
  if (name === "sales_summary") {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await client.from("orders").select("total, status, created_at").gte("created_at", since);
    if (error) throw new Error(error.message);
    const rowsIn = data || [];
    const revenue = rowsIn.reduce((sum, o) => sum + Number(o.total || 0), 0);
    return { days: 30, orders: rowsIn.length, revenue_inr: Math.round(revenue), by_status: rowsIn.reduce<Record<string, number>>((m, o) => { m[String(o.status)] = (m[String(o.status)] || 0) + 1; return m; }, {}) };
  }
  if (name === "list_agents") {
    const list = [];
    for (const a of AGENTS) {
      if (a.key === "orchestrator") continue;
      const cfg = await agentConfig(a.key);
      list.push({ agent: a.key, name: a.name, owns: a.description, enabled: cfg.enabled });
    }
    return { agents: list };
  }
  if (name === "calculate_price") {
    const s = await settings();
    return price(Number(args.filament_grams) || 0, Number(args.print_hours) || 0, String(args.material || "PLA"), s.pricing);
  }
  if (name === "save_insight" || name === "create_content_draft" || name === "create_design_brief" || name === "draft_customer_message" || name === "create_draft_product") {
    const kind = name === "save_insight" ? "insights" : name === "create_content_draft" ? "content" : name === "create_design_brief" ? "assets" : name === "draft_customer_message" ? "messages" : "products";
    const doc = await insert(kind, { ...args, status: name === "create_draft_product" ? "draft" : "draft", created_by: ctx.agent, run_id: ctx.runId, created_at: new Date().toISOString() });
    return { id: doc.id, status: "draft" };
  }
  throw new Error(`Tool ${name} is not available`);
}

const TOOL_SCHEMAS: Record<string, { description: string; properties: Record<string, unknown>; required?: string[] }> = {
  list_orders: { description: "Recent website orders.", properties: {} },
  get_order: { description: "One order by order number.", properties: { order_number: { type: "string" } }, required: ["order_number"] },
  list_products: { description: "Live catalog products.", properties: {} },
  get_product: { description: "One product by slug.", properties: { slug: { type: "string" } }, required: ["slug"] },
  best_sellers: { description: "Products currently on the store.", properties: {} },
  list_inquiries: { description: "Recent gifting, PYOT and contact inquiries.", properties: {} },
  sales_summary: { description: "Order count and revenue for the last 30 days.", properties: {} },
  list_agents: { description: "Specialist agents and whether they are enabled.", properties: {} },
  calculate_price: { description: "Price a print from grams and hours.", properties: { filament_grams: { type: "number" }, print_hours: { type: "number" }, material: { type: "string" } }, required: ["filament_grams", "print_hours"] },
  save_insight: { description: "Save a short report.", properties: { title: { type: "string" }, summary: { type: "string" } }, required: ["title", "summary"] },
  create_content_draft: { description: "Save an Instagram draft.", properties: { title: { type: "string" }, caption: { type: "string" }, visual_brief: { type: "string" }, hashtags: { type: "array" } }, required: ["title", "caption", "visual_brief"] },
  create_design_brief: { description: "Save a printable design brief.", properties: { title: { type: "string" }, concept: { type: "string" }, printability: { type: "string" } }, required: ["title", "concept", "printability"] },
  draft_customer_message: { description: "Save a customer message draft. Does not send it.", properties: { to: { type: "string" }, body: { type: "string" }, subject: { type: "string" }, order_number: { type: "string" } }, required: ["to", "body"] },
  create_draft_product: { description: "Save a hidden product draft. Does not publish it.", properties: { name: { type: "string" }, tagline: { type: "string" }, description: { type: "string" }, price_inr: { type: "number" } }, required: ["name", "description", "price_inr"] },
  update_order_status: { description: "Propose an order status change. Requires approval.", properties: { order_number: { type: "string" }, status: { type: "string" }, reason: { type: "string" } }, required: ["order_number", "status", "reason"] },
  delegate_to_agent: { description: "Ask a specialist to do a task. Requires approval before that specialist runs.", properties: { agent: { type: "string" }, task: { type: "string" }, reason: { type: "string" } }, required: ["agent", "task", "reason"] },
};

async function claude(model: string, system: string, messages: unknown[], tools: unknown[]) {
  const key = process.env.ANTHROPIC_API_KEY || "";
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1200, system, messages, ...(tools.length ? { tools } : {}) }),
  });
  const data = (await res.json()) as { error?: { message?: string }; content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`);
  return data;
}

function cost(model: string, input: number, output: number) {
  const table: Record<string, [number, number]> = { "claude-haiku-4-5": [1, 5], "claude-sonnet-5": [2, 10], "claude-opus-5-5": [4, 20] };
  const [pin, pout] = table[model] || [2, 10];
  return Math.round(((input * pin + output * pout) / 1_000_000) * 10000) / 10000;
}

export async function executeRun(runId: string): Promise<void> {
  const run = (await rows("run")).find((r) => r.id === runId);
  if (!run) throw new Error("Run not found");
  const cfg = await agentConfig(String(run.agent));
  const s = await settings();
  const names = cfg.tools;
  const tools = names.map((name) => {
    const spec = TOOL_SCHEMAS[name];
    return { name, description: spec?.description || name, input_schema: { type: "object", properties: spec?.properties || {}, required: spec?.required || [] } };
  });
  const system = `You are ${cfg.name} for Toying Idea, an Indian 3D-printed toy brand. Prices are INR. ${agentDef(String(run.agent))?.prompt || ""}\n${cfg.instructions}\nBrand tone: ${s.business.tone}. Lead time: ${s.business.production_lead_days}. Tools that change an order are queued for the owner. Finish with a short summary.`;
  const messages: unknown[] = [{ role: "user", content: String(run.task || "") }];
  const steps: unknown[] = [];
  let input = 0;
  let output = 0;
  let finalText = "";
  try {
    for (let step = 0; step < Math.min(3, s.max_steps); step++) {
      const resp = await claude(cfg.model, system, messages, tools);
      input += resp.usage?.input_tokens || 0;
      output += resp.usage?.output_tokens || 0;
      const content = resp.content || [];
      messages.push({ role: "assistant", content });
      const text = content.filter((b) => b.type === "text").map((b) => b.text || "").join("\n").trim();
      if (text) steps.push({ type: "message", at: new Date().toISOString(), text });
      const uses = content.filter((b) => b.type === "tool_use");
      if (resp.stop_reason !== "tool_use" || !uses.length) {
        finalText = text;
        break;
      }
      const results = [];
      for (const tu of uses) {
        const args = tu.input || {};
        if (ACTION_TOOLS.has(tu.name || "")) {
          const action = await insert("action", {
            agent: cfg.key,
            tool: tu.name,
            label: tu.name,
            summary: JSON.stringify(args).slice(0, 240),
            args,
            reason: String(args.reason || ""),
            run_id: runId,
            status: "pending",
            created_at: new Date().toISOString(),
          });
          steps.push({ type: "tool", at: new Date().toISOString(), tool: tu.name, status: "pending_approval", input: args, action_id: action.id });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ status: "pending_approval", action_id: action.id }) });
        } else {
          try {
            const out = await toolCall(tu.name || "", args, { agent: cfg.key, runId });
            steps.push({ type: "tool", at: new Date().toISOString(), tool: tu.name, status: "ok", input: args, output: out });
            results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 8000) });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Tool failed";
            steps.push({ type: "tool", at: new Date().toISOString(), tool: tu.name, status: "error", input: args, output: { error: message } });
            results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ error: message }), is_error: true });
          }
        }
      }
      messages.push({ role: "user", content: results });
    }
    await patch(runId, { status: "completed", output: finalText || "Done.", steps, finished_at: new Date().toISOString(), usage: { input_tokens: input, output_tokens: output, cost_usd: cost(cfg.model, input, output), llm_calls: steps.filter((s) => (s as { type?: string }).type === "message").length } });
  } catch (err) {
    await patch(runId, { status: "failed", error: err instanceof Error ? err.message : "Run failed", steps, finished_at: new Date().toISOString() });
  }
}

async function approve(id: string, by: string) {
  const action = (await rows("action")).find((a) => a.id === id);
  if (!action) throw new Error("Action not found");
  if (action.status !== "pending") throw new Error(`Action is already ${action.status}`);
  const args = (action.args || {}) as Record<string, unknown>;
  if (action.tool === "update_order_status") {
    const number = String(args.order_number || "");
    const status = String(args.status || "");
    const { data: order, error } = await sb().from("orders").select("id, status, status_history").eq("order_number", number).maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");
    const history = Array.isArray(order.status_history) ? order.status_history : [];
    const { error: upd } = await sb().from("orders").update({
      status,
      status_history: [...history, { at: new Date().toISOString(), title: status, by }],
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    if (upd) throw new Error(upd.message);
  }
  if (action.tool === "delegate_to_agent") {
    const child = await startRun(String(args.agent || ""), String(args.task || ""), by);
    await patch(id, { status: "executed", result: { run_id: child }, decided_by: by, decided_at: new Date().toISOString() });
    return;
  }
  await patch(id, { status: "executed", decided_by: by, decided_at: new Date().toISOString() });
}

export async function startRun(agent: string, task: string, by: string) {
  if (!agentDef(agent)) throw new Error("Unknown agent");
  const cfg = await agentConfig(agent);
  if (!cfg.enabled) throw new Error(`${cfg.name} is disabled`);
  const s = await settings();
  if (s.paused) throw new Error("Agent OS is paused");
  const run = await insert("run", {
    agent,
    task,
    trigger: { type: "manual", by },
    status: "running",
    created_at: new Date().toISOString(),
    steps: [],
  });
  await executeRun(run.id);
  return run.id;
}

export async function handleAgentOs(req: { method?: string; query: Record<string, string | string[] | undefined>; body?: unknown }, email: string) {
  const a = q1(req.query.a);
  const b = q1(req.query.b);
  const c = q1(req.query.c);
  const method = req.method || "GET";
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;

  if (a === "overview" && method === "GET") {
    const s = await settings();
    const runs = await rows("run");
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const today = runs.filter((r) => String(r.created_at || "") >= start.toISOString());
    const actions = await rows("action");
    const agents = [];
    for (const def of AGENTS) {
      const cfg = await agentConfig(def.key);
      const mine = runs.filter((r) => r.agent === def.key);
      agents.push({ ...cfg, runs_today: today.filter((r) => r.agent === def.key).length, failed_today: today.filter((r) => r.agent === def.key && r.status === "failed").length, last_run_at: mine[0]?.created_at || null, last_status: mine[0]?.status || null });
    }
    const { count } = await sb().from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "Placed", "In production", "Quality check"]);
    return {
      paused: s.paused,
      pending_actions: actions.filter((x) => x.status === "pending").length,
      runs_today: today.length,
      failed_today: today.filter((r) => r.status === "failed").length,
      running: runs.filter((r) => r.status === "running" || r.status === "queued").length,
      cost_today_usd: today.reduce((sum, r) => sum + Number((r.usage as { cost_usd?: number } | undefined)?.cost_usd || 0), 0),
      daily_run_budget: s.daily_run_budget,
      open_orders: count || 0,
      draft_messages: (await rows("messages")).filter((m) => m.status === "draft" || m.status === "ready_to_send").length,
      api_key_configured: Boolean(process.env.ANTHROPIC_API_KEY),
      worker_enabled: false,
      channels: { email: Boolean(process.env.RESEND_API_KEY), instagram: false, whatsapp: false },
      agents,
      recent_runs: runs.slice(0, 12).map(({ steps: _steps, ...rest }) => rest),
    };
  }

  if (a === "settings" && method === "GET") return settings();
  if (a === "settings" && method === "PATCH") {
    const current = (await rows("settings"))[0];
    const next = { ...(await settings()), ...body };
    if (current) await patch(current.id, next);
    else await insert("settings", next);
    return settings();
  }

  if (a === "agents" && method === "GET" && !b) {
    const agents = [];
    for (const def of AGENTS) agents.push(await agentConfig(def.key));
    return { agents, models: MODELS };
  }
  if (a === "agents" && b && method === "PATCH") {
    const current = (await rows("agent")).find((row) => row.key === b);
    const fields = { key: b, enabled: body.enabled, model: body.model, instructions: body.instructions, auto_approve_tools: body.auto_approve_tools };
    if (current) await patch(current.id, fields);
    else await insert("agent", fields);
    return agentConfig(b);
  }
  if (a === "agents" && b && c === "run" && method === "POST") {
    const id = await startRun(b, String(body.task || ""), email);
    return { run_id: id };
  }

  if (a === "runs" && method === "GET" && !b) {
    let runs = await rows("run");
    const agent = q1(req.query.agent);
    const status = q1(req.query.status_filter);
    if (agent) runs = runs.filter((r) => r.agent === agent);
    if (status) runs = runs.filter((r) => r.status === status);
    return { runs: runs.slice(0, 100).map(({ steps: _s, ...rest }) => rest) };
  }
  if (a === "runs" && b && method === "GET") {
    const run = (await rows("run")).find((r) => r.id === b);
    if (!run) throw new Error("Run not found");
    const actions = (await rows("action")).filter((act) => act.run_id === b);
    return { run, actions, children: [] };
  }

  if (a === "actions" && method === "GET" && !b) {
    let actions = await rows("action");
    const status = q1(req.query.status_filter);
    if (status) actions = actions.filter((act) => act.status === status);
    return { actions };
  }
  if (a === "actions" && b && c === "approve" && method === "POST") {
    await approve(b, email);
    return { ok: true };
  }
  if (a === "actions" && b && c === "reject" && method === "POST") {
    await patch(b, { status: "rejected", note: body.note || null, decided_by: email, decided_at: new Date().toISOString() });
    return { ok: true };
  }
  if (a === "actions" && b && c === "retry" && method === "POST") {
    await patch(b, { status: "pending", error: null });
    await approve(b, email);
    return { ok: true };
  }

  if (a === "workflows" && method === "GET") {
    const workflows = await ensureWorkflows();
    return {
      workflows,
      event_types: [{ type: "order.created", label: "A website order was placed" }, { type: "request.created", label: "A custom request was submitted" }],
      agents: AGENTS.map((agent) => ({ key: agent.key, name: agent.name })),
    };
  }
  if (a === "workflows" && method === "POST") {
    const doc = await insert("workflow", { ...body, enabled: body.enabled !== false, run_count: 0 });
    return doc;
  }
  if (a === "workflows" && b && method === "PATCH") return patch(b, body);
  if (a === "workflows" && b && method === "DELETE") {
    await remove(b);
    return null;
  }
  if (a === "workflows" && b && c === "run" && method === "POST") {
    const wf = (await rows("workflow")).find((w) => w.id === b);
    if (!wf) throw new Error("Workflow not found");
    const id = await startRun(String(wf.agent), String(wf.instruction || wf.name), email);
    await patch(b, { last_run_id: id, last_run_at: new Date().toISOString(), run_count: Number(wf.run_count || 0) + 1 });
    return { run_id: id };
  }
  if (a === "tick" && method === "POST") return { started: [] };

  if (a === "data" && b && method === "GET") {
    const items = await rows(b);
    return { items };
  }
  if (a === "data" && b && c && method === "PATCH") return patch(c, body);

  throw new Error("Not found");
}
