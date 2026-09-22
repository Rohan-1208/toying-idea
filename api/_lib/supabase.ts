import { setDefaultResultOrder } from "node:dns";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Node 18+ prefers IPv6; Vercel Hobby often cannot reach supabase.co over AAAA.
try {
  setDefaultResultOrder("ipv4first");
} catch {
  /* ignore older runtimes */
}

declare global {
  // eslint-disable-next-line no-var
  var _supabase: SupabaseClient | undefined;
}

function readEnv(...names: string[]): string {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const value = raw.trim().replace(/^["']+|["']+$/g, "");
    if (value) return value;
  }
  return "";
}

export function formatUnknownError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts = [err.message];
  const cause = err.cause as { message?: string; code?: string } | Error | undefined;
  if (cause instanceof Error) {
    parts.push(cause.message);
    const code = (cause as NodeJS.ErrnoException).code;
    if (code) parts.push(code);
  } else if (cause && typeof cause === "object") {
    if (cause.message) parts.push(String(cause.message));
    if (cause.code) parts.push(String(cause.code));
  }
  return parts.filter(Boolean).join(" — ");
}

export function supabaseConfig() {
  const url = readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/$/, "");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  let keyKind: "missing" | "publishable" | "secret" | "jwt" | "other" = "missing";
  if (key.startsWith("sb_publishable_")) keyKind = "publishable";
  else if (key.startsWith("sb_secret_")) keyKind = "secret";
  else if (key.startsWith("eyJ")) keyKind = "jwt";
  else if (key) keyKind = "other";

  let host = "";
  try {
    host = url ? new URL(url).hostname : "";
  } catch {
    host = "";
  }
  const urlOk = /^[a-z0-9]+\.supabase\.co$/i.test(host);
  return { url, key, keyKind, host, urlOk };
}

export function getSupabase(): SupabaseClient {
  if (global._supabase) return global._supabase;
  const { url, key, keyKind, host, urlOk } = supabaseConfig();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Vercel env), then redeploy."
    );
  }
  if (!urlOk) {
    throw new Error(
      `SUPABASE_URL must be https://YOURPROJECT.supabase.co (got ${host || url.slice(0, 48)}). Copy Project URL from Supabase → Settings → API, not the dashboard link or the Postgres URI.`
    );
  }
  if (keyKind === "publishable") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is a publishable key. Use Legacy anon, service_role API keys → service_role (starts with eyJ)."
    );
  }
  global._supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        try {
          return await fetch(input, init);
        } catch (err) {
          throw new Error(`Supabase could not be reached at ${host}: ${formatUnknownError(err)}`, { cause: err });
        }
      },
    },
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
  const { url } = supabaseConfig();
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path}`;
}
