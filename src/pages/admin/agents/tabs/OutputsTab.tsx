import { useState } from "react";
import type { DashboardCtx } from "../AgentOSClient";
import { api, formatDateTime, timeAgo, useApi, type ContentItem, type CustomerMessage, type Insight } from "../api";
import { Empty, Json, SmallButton, StatusPill, cx, textareaCls } from "./ui";

const KINDS = [
  { key: "insights", label: "Reports" },
  { key: "messages", label: "Customer messages" },
  { key: "content", label: "Content" },
  { key: "assets", label: "3D & assets" },
  { key: "customers", label: "Customers" },
  { key: "inventory", label: "Inventory" },
  { key: "events", label: "Event log" },
] as const;

type Kind = (typeof KINDS)[number]["key"];
type Row = Record<string, unknown> & { id: string };

export function OutputsTab({ ctx }: { ctx: DashboardCtx }) {
  const [kind, setKind] = useState<Kind>("insights");
  const { data, reload: load } = useApi<{ items: Row[] }>(`/data/${kind}?limit=60`, ctx.tick);
  const items = data?.items ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1 rounded-full border border-ink/10 bg-cream-50 p-1 w-fit">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k.key)}
            className={cx("rounded-full px-3 py-1.5 text-xs font-medium", kind === k.key ? "bg-ink text-cream-50" : "text-ink/50 hover:text-ink")}
          >
            {k.label}
          </button>
        ))}
      </div>
      {items === null ? (
        <div className="text-sm text-ink/50">Loading…</div>
      ) : items.length === 0 ? (
        <Empty>Nothing here yet. Agents fill this as they work.</Empty>
      ) : kind === "insights" ? (
        <div className="grid gap-3">{(items as unknown as Insight[]).map((i) => <InsightCard key={i.id} i={i} ctx={ctx} />)}</div>
      ) : kind === "messages" ? (
        <div className="grid gap-3">{(items as unknown as CustomerMessage[]).map((m) => <MessageCard key={m.id} m={m} onChanged={load} />)}</div>
      ) : kind === "content" ? (
        <div className="grid gap-3 md:grid-cols-2">{(items as unknown as ContentItem[]).map((c) => <ContentCard key={c.id} c={c} onChanged={load} />)}</div>
      ) : kind === "customers" ? (
        <SimpleTable rows={items} cols={[["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["order_count", "Orders"], ["lifetime_value", "LTV ₹"], ["last_order_at", "Last order"]]} />
      ) : kind === "inventory" ? (
        <SimpleTable rows={items} cols={[["sku", "SKU"], ["name", "Name"], ["on_hand", "On hand"], ["reserved", "Reserved"], ["reorder_point", "Reorder at"], ["made_to_order", "Made to order"]]} />
      ) : kind === "events" ? (
        <SimpleTable rows={items} cols={[["created_at", "When"], ["type", "Event"], ["source", "Source"], ["status", "Status"], ["payload", "Data"]]} />
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <details key={a.id} className="rounded-3xl border border-ink/10 bg-cream-50 p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{String(a.title ?? a.id)}</span>
                <StatusPill status={String(a.type)} />
                {a.job ? <StatusPill status={String((a.job as { status?: string }).status)} /> : null}
                <span className="text-[11px] text-ink/50">{timeAgo(String(a.created_at))}</span>
              </summary>
              <div className="mt-3">
                <Json value={(a.content as { script?: string })?.script ?? a.content} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ i, ctx }: { i: Insight; ctx: DashboardCtx }) {
  return (
    <article className="grid gap-3 rounded-3xl border border-ink/10 bg-cream-50 p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg tracking-tight">{i.title}</h3>
          <StatusPill status={i.kind} />
        </div>
        <span className="text-[11px] text-ink/50">{formatDateTime(i.created_at)}</span>
      </header>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">{i.summary}</div>
      {i.recommendations?.length ? (
        <ul className="grid gap-2">
          {i.recommendations.map((r, idx) => (
            <li key={idx} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-cream px-3 py-2">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className={cx("h-2 w-2 rounded-full", r.priority === "high" ? "bg-red-500" : r.priority === "medium" ? "bg-amber-500" : "bg-stone-400")} />
                  {r.title}
                </div>
                <div className="text-xs text-ink/50">{r.rationale}</div>
              </div>
              {r.suggested_agent ? (
                <SmallButton onClick={() => ctx.newTask(r.suggested_agent, `${r.title}\n\nContext: ${r.rationale}`)}>Hand to agent</SmallButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function MessageCard({ m, onChanged }: { m: CustomerMessage; onChanged: () => Promise<void> }) {
  const [body, setBody] = useState(m.body);
  const [copied, setCopied] = useState(false);
  const editable = m.status === "draft";
  return (
    <article className="grid gap-2 rounded-3xl border border-ink/10 bg-cream-50 p-4">
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill status={m.status} />
        <span className="font-medium">{m.customer_name ?? m.to}</span>
        <span className="text-xs text-ink/50">
          {m.channel} · {m.to} {m.order_number ? `· ${m.order_number}` : ""} · {timeAgo(m.created_at)}
        </span>
      </header>
      {m.subject ? <div className="text-xs text-ink/50">Subject: {m.subject}</div> : null}
      {editable ? (
        <textarea className={cx(textareaCls, "min-h-28")} value={body} onChange={(e) => setBody(e.target.value)} />
      ) : (
        <div className="whitespace-pre-wrap text-sm">{m.body}</div>
      )}
      {m.delivery?.note ? <div className="text-[11px] text-amber-800">{m.delivery.note}</div> : null}
      <div className="flex flex-wrap gap-2">
        {editable && body !== m.body ? (
          <SmallButton variant="dark" onClick={async () => { await api(`/data/messages/${m.id}`, { method: "PATCH", json: { body } }); await onChanged(); }}>
            Save edit
          </SmallButton>
        ) : null}
        <SmallButton
          onClick={async () => {
            await navigator.clipboard.writeText(m.subject ? `${m.subject}\n\n${m.body}` : m.body);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy text"}
        </SmallButton>
        {m.status === "ready_to_send" ? (
          <SmallButton variant="primary" onClick={async () => { await api(`/data/messages/${m.id}`, { method: "PATCH", json: { status: "sent" } }); await onChanged(); }}>
            Mark as sent
          </SmallButton>
        ) : null}
      </div>
    </article>
  );
}

function ContentCard({ c, onChanged }: { c: ContentItem; onChanged: () => Promise<void> }) {
  const [caption, setCaption] = useState(c.caption);
  const editable = c.status === "draft";
  return (
    <article className="grid content-start gap-2 rounded-3xl border border-ink/10 bg-cream-50 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <StatusPill status={c.status} />
        <span className="rounded-full bg-ti-sky/25 px-2 py-0.5 text-[11px] font-medium">{c.type}</span>
        <span className="text-sm font-medium">{c.title}</span>
      </header>
      <div className="text-[11px] text-ink/50">
        {c.scheduled_for ? `Scheduled ${c.scheduled_for}` : c.suggested_slot ? `Suggested ${c.suggested_slot}` : ""} {c.product_slugs?.length ? `· ${c.product_slugs.join(", ")}` : ""}
      </div>
      {editable ? (
        <textarea className={cx(textareaCls, "min-h-24")} value={caption} onChange={(e) => setCaption(e.target.value)} />
      ) : (
        <div className="whitespace-pre-wrap text-sm">{c.caption}</div>
      )}
      <div className="text-xs text-ink/70">{c.hashtags?.join(" ")}</div>
      <details className="text-xs">
        <summary className="cursor-pointer text-ink/50">Visual brief{c.reel_script ? " & reel script" : ""}</summary>
        <div className="mt-2 grid gap-2 whitespace-pre-wrap">
          <div>{c.visual_brief}</div>
          {c.reel_script ? <div className="rounded bg-cream p-2">{c.reel_script}</div> : null}
        </div>
      </details>
      {editable && caption !== c.caption ? (
        <div>
          <SmallButton variant="dark" onClick={async () => { await api(`/data/content/${c.id}`, { method: "PATCH", json: { caption } }); await onChanged(); }}>
            Save caption
          </SmallButton>
        </div>
      ) : null}
    </article>
  );
}

function SimpleTable({ rows, cols }: { rows: Row[]; cols: Array<[string, string]> }) {
  const fmt = (v: unknown, key: string) => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "yes" : "no";
    if (typeof v === "object") return JSON.stringify(v);
    if (key.endsWith("_at")) return formatDateTime(String(v));
    return String(v);
  };
  return (
    <div className="overflow-x-auto rounded-3xl border border-ink/10 bg-cream-50">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink/50">
            {cols.map(([k, l]) => (
              <th key={k} className="px-4 py-3 font-medium">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ink/10/60 last:border-0">
              {cols.map(([k]) => (
                <td key={k} className="max-w-[360px] truncate px-4 py-2.5 text-xs">
                  {fmt(r[k], k)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
