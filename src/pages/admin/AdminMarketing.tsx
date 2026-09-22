import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, Input, Spinner } from "../../components/ui";

export default function AdminMarketing() {
  const [productName, setProductName] = useState("");
  const [trend, setTrend] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const generate = async () => {
    setError("");
    setDone(false);
    setBusy(true);
    try {
      await api.studio.marketing({ productName, trend, extraImages: 2 });
      setDone(true);
      setProductName("");
      setTrend("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate pack");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Marketing</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/55">
        Build a caption, hashtags, reel shots, and stills. Packs wait in Approvals — nothing posts to Instagram
        automatically.
      </p>

      <div className="mt-6 max-w-xl space-y-4 rounded-3xl border border-ink/10 bg-cream p-6">
        <Input
          label="Product"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Aura Rocket"
        />
        <Input
          label="Trend or hook"
          value={trend}
          onChange={(e) => setTrend(e.target.value)}
          placeholder="desk collectibles, gifting season…"
        />
        {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}
        {done && (
          <p className="rounded-xl bg-teal/10 px-4 py-3 text-sm text-teal-deep">
            Draft pack ready.{" "}
            <Link to="/admin/approvals" className="font-semibold underline">
              Review in Approvals
            </Link>
          </p>
        )}
        <Button onClick={generate} disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Generating pack…
            </span>
          ) : (
            "Generate social pack"
          )}
        </Button>
      </div>
    </div>
  );
}
