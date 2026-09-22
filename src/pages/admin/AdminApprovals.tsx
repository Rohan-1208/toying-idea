import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { StudioDraft } from "../../lib/types";
import { formatDateTime } from "../../lib/format";
import { Button, Spinner, Textarea } from "../../components/ui";

export default function AdminApprovals() {
  const [items, setItems] = useState<StudioDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = () => {
    setLoading(true);
    api.studio
      .drafts("pending")
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load drafts"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const approve = async (draft: StudioDraft) => {
    setBusyId(draft._id);
    try {
      if (draft.agent === "inbox") {
        await api.studio.inboxSend(draft._id);
      } else {
        await api.studio.approveDraft(draft._id);
      }
      setItems((prev) => prev.filter((d) => d._id !== draft._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId("");
    }
  };

  const reject = async (draft: StudioDraft) => {
    setBusyId(draft._id);
    try {
      await api.studio.rejectDraft(draft._id);
      setItems((prev) => prev.filter((d) => d._id !== draft._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId("");
    }
  };

  const savePayload = async (draft: StudioDraft, payload: Record<string, unknown>) => {
    const { draft: updated } = await api.studio.patchDraft(draft._id, { payload });
    setItems((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Approvals</h1>
      <p className="mt-1 text-sm text-ink/55">
        Every public action waits here. Approve to publish a listing, send a reply, or open a website ticket.
        Marketing packs stay internal after approval.
      </p>

      {error && <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-6 w-6" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-20 text-center text-ink/40">No pending drafts.</p>
      ) : (
        <div className="mt-5 grid gap-4">
          {items.map((draft) => (
            <DraftCard
              key={draft._id}
              draft={draft}
              busy={busyId === draft._id}
              onApprove={() => approve(draft)}
              onReject={() => reject(draft)}
              onSave={(payload) => savePayload(draft, payload)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  busy,
  onApprove,
  onReject,
  onSave,
}: {
  draft: StudioDraft;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const payload = draft.payload || {};
  const images = [...((payload.photos as string[]) || []), ...((payload.generated as string[]) || []), ...((payload.stills as string[]) || [])];

  return (
    <article className="rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink/45">{draft.agent}</p>
          <h2 className="font-display text-xl font-bold text-ink">{draft.title}</h2>
          <p className="text-xs text-ink/40">{formatDateTime(draft.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={onReject}>
            Reject
          </Button>
          <Button size="sm" disabled={busy} onClick={onApprove}>
            {busy ? "Working…" : draft.agent === "inbox" ? "Send reply" : "Approve"}
          </Button>
        </div>
      </div>

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.slice(0, 8).map((src) => (
            <img key={src} src={src} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ))}
        </div>
      )}

      {typeof payload.description === "string" && (
        <p className="mt-3 text-sm text-ink/70">{payload.description}</p>
      )}
      {typeof payload.price === "number" && (
        <p className="mt-2 text-sm font-semibold text-ink">₹{payload.price}</p>
      )}
      {typeof payload.caption === "string" && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink/70">{payload.caption}</p>
      )}
      {typeof payload.body === "string" && (
        <Textarea
          className="mt-3"
          rows={6}
          defaultValue={payload.body}
          onBlur={(e) => {
            if (e.target.value !== payload.body) onSave({ ...payload, body: e.target.value });
          }}
        />
      )}
      {typeof payload.brief === "string" && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink/70">{payload.brief}</p>
      )}
    </article>
  );
}
