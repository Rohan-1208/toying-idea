import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, methodNotAllowed, readBody } from "../_lib/http.js";
import { verifyAdmin } from "../_lib/auth.js";
import { getSupabase } from "../_lib/supabase.js";
import { throwIf } from "../_lib/map.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  verifyAdmin(req);
  const sb = getSupabase();
  const id = req.query.id as string | undefined;

  if (req.method === "GET") {
    const { data, error } = await sb.from("print_jobs").select("*").order("created_at", { ascending: false }).limit(200);
    throwIf(error);
    res.status(200).json({ items: data || [] });
    return;
  }

  if (req.method === "PATCH" && id) {
    const body = readBody<{ status?: string; printer?: string; dueAt?: string; notes?: string }>(req);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) patch.status = body.status;
    if (body.printer != null) patch.printer = body.printer;
    if (body.dueAt) patch.due_at = body.dueAt;
    if (body.notes != null) patch.notes = body.notes;
    const { data, error } = await sb.from("print_jobs").update(patch).eq("id", id).select("*").maybeSingle();
    throwIf(error);
    if (!data) throw new Error("Print job not found");

    if (body.status === "printing" || body.status === "done") {
      const orderStatus = body.status === "done" ? "confirmed" : "printing";
      if (data.order_id) {
        await sb.from("orders").update({
          status: body.status === "done" ? "confirmed" : "printing",
          updated_at: new Date().toISOString(),
        }).eq("id", data.order_id);
      }
      void orderStatus;
    }
    res.status(200).json({ job: data });
    return;
  }

  return methodNotAllowed(res, ["GET", "PATCH"]);
});
