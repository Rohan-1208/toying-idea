import type { VercelRequest, VercelResponse } from "@vercel/node";
import { formatUnknownError } from "./supabase.js";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown> | unknown;

// Wrap a handler with CORS, OPTIONS preflight and uniform error handling.
export function withApi(handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    try {
      await handler(req, res);
    } catch (err: unknown) {
      const raw = formatUnknownError(err);
      const message =
        /fetch failed|could not be reached/i.test(raw)
          ? `${raw}. SUPABASE_URL must be https://YOURPROJECT.supabase.co (Project URL from Settings → API).`
          : raw || "Internal Server Error";
      // Surface validation-ish errors as 400, otherwise 500.
      const status = /required|invalid|exists|not found|unauthor/i.test(message)
        ? message.toLowerCase().includes("not found")
          ? 404
          : message.toLowerCase().includes("unauthor")
            ? 401
            : 400
        : 500;
      if (!res.headersSent) res.status(status).json({ error: message });
    }
  };
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ error: `Method not allowed. Allowed: ${allowed.join(", ")}` });
}

// Robustly read a JSON body (Vercel usually parses it, but be defensive).
export function readBody<T = Record<string, unknown>>(req: VercelRequest): T {
  if (req.body && typeof req.body === "object") return req.body as T;
  if (typeof req.body === "string" && req.body.length) {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      throw new Error("Invalid JSON body");
    }
  }
  return {} as T;
}
