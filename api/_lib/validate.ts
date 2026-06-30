const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireString(value: unknown, field: string, min = 1): string {
  if (typeof value !== "string") throw new Error(`${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new Error(`${field} is required`);
  return trimmed;
}

export function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(value: unknown): string {
  const email = requireString(value, "Email").toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Invalid email address");
  return email;
}

export function positiveInt(value: unknown, fallback = 1): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function pickEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Invalid ${field}`);
  }
  return value as T;
}

export function sanitizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
