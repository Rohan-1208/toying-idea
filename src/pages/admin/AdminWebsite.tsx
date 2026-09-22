import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, Spinner, Textarea } from "../../components/ui";

export default function AdminWebsite() {
  const [requestText, setRequestText] = useState("");
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const load = () => {
    api.studio
      .websiteTickets()
      .then((res) => setTickets(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load tickets"));
  };

  useEffect(load, []);

  const submit = async () => {
    setError("");
    setDone(false);
    if (!requestText.trim()) {
      setError("Describe the feature or change.");
      return;
    }
    setBusy(true);
    try {
      await api.studio.websiteRequest(requestText.trim());
      setRequestText("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create ticket draft");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Website</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/55">
        Ask for a feature. The agent writes a ticket — it does not commit code. Approve the ticket, then build it in
        this repo.
      </p>

      <div className="mt-6 max-w-2xl space-y-4 rounded-3xl border border-ink/10 bg-cream p-6">
        <Textarea
          label="What should change?"
          rows={4}
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          placeholder="Add a gift-wrap note on checkout…"
        />
        {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}
        {done && (
          <p className="rounded-xl bg-teal/10 px-4 py-3 text-sm text-teal-deep">
            Ticket draft ready.{" "}
            <Link to="/admin/approvals" className="font-semibold underline">
              Review in Approvals
            </Link>
          </p>
        )}
        <Button onClick={submit} disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Drafting ticket…
            </span>
          ) : (
            "Draft ticket"
          )}
        </Button>
      </div>

      <h2 className="mt-10 font-display text-xl font-bold text-ink">Open tickets</h2>
      {tickets.length === 0 ? (
        <p className="mt-4 text-sm text-ink/40">No approved website tickets yet.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {tickets.map((t) => (
            <div key={String(t.id)} className="rounded-2xl border border-ink/10 bg-cream p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">
                {String(t.priority || "normal")} · {String(t.status || "open")}
              </p>
              <p className="font-medium text-ink">{String(t.title)}</p>
              <p className="mt-1 text-sm text-ink/60">{String(t.brief || "")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
