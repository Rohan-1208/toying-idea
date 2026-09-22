import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, Spinner, Textarea } from "../../components/ui";

async function fileToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:${file.type || "image/jpeg"};base64,${btoa(binary)}`;
}

export default function AdminCatalog() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneId, setDoneId] = useState("");

  const onFiles = (list: FileList | null) => {
    const next = Array.from(list || []).filter((f) => f.type.startsWith("image/")).slice(0, 6);
    setFiles(next);
    Promise.all(next.map(fileToDataUrl)).then(setPreviews);
  };

  const generate = async () => {
    setError("");
    setDoneId("");
    if (!files.length) {
      setError("Add at least one phone photo of the print.");
      return;
    }
    setBusy(true);
    try {
      const photos: string[] = [];
      for (const file of files) {
        const data = await fileToDataUrl(file);
        const { url } = await api.studio.upload({
          filename: file.name,
          contentType: file.type || "image/jpeg",
          data,
        });
        photos.push(url);
      }
      const { draft } = await api.studio.catalogGenerate({ photos, notes, extraImages: 2 });
      setDoneId(draft._id);
      setFiles([]);
      setPreviews([]);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate listing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Catalog</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/55">
        Photograph a PLA piece, then generate extra stills, copy, and a price. Nothing goes live until you approve
        it.
      </p>

      <div className="mt-6 max-w-2xl space-y-4 rounded-3xl border border-ink/10 bg-cream p-6">
        <label className="block cursor-pointer rounded-2xl border border-dashed border-ink/20 bg-white/60 px-4 py-8 text-center">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <p className="font-medium text-ink">Drop phone photos here</p>
          <p className="mt-1 text-xs text-ink/50">Up to 6 images. JPG or PNG.</p>
        </label>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <img key={i} src={src} alt="" className="h-20 w-20 rounded-xl object-cover" />
            ))}
          </div>
        )}
        <Textarea
          label="Studio notes (optional)"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Colour, size, who it's for…"
        />
        {error && <p className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay-deep">{error}</p>}
        {doneId && (
          <p className="rounded-xl bg-teal/10 px-4 py-3 text-sm text-teal-deep">
            Draft ready.{" "}
            <Link to="/admin/approvals" className="font-semibold underline">
              Review in Approvals
            </Link>
          </p>
        )}
        <Button onClick={generate} disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Generating listing…
            </span>
          ) : (
            "Generate draft listing"
          )}
        </Button>
      </div>
    </div>
  );
}
