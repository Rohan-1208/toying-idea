import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var _supabase: SupabaseClient | undefined;
}

export function getSupabase(): SupabaseClient {
  if (global._supabase) return global._supabase;
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Vercel env), then redeploy."
    );
  }
  global._supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return global._supabase;
}

export async function connectDB(): Promise<SupabaseClient> {
  const sb = getSupabase();
  const { error } = await sb.from("products").select("id").limit(1);
  if (error) throw new Error(error.message);
  return sb;
}

export function publicStorageUrl(path: string): string {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  return `${url}/storage/v1/object/public/product-images/${path}`;
}
