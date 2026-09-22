import { getSupabase } from "./supabase.js";

export async function nextOrderNumber(): Promise<string> {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const key = `orders-${ymd}`;
  const sb = getSupabase();

  const { data: existing } = await sb.from("counters").select("seq").eq("key", key).maybeSingle();
  const seq = (existing?.seq ?? 0) + 1;
  const { error } = await sb.from("counters").upsert({ key, seq });
  if (error) throw new Error(error.message);
  return `TI-${ymd}-${String(seq).padStart(4, "0")}`;
}
