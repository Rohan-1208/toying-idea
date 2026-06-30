import type { VercelRequest } from "@vercel/node";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not configured");
  }
  return s || "dev-insecure-secret-change-me";
};

export type AdminClaims = { sub: string; email: string; role: "admin" };

export function signAdminToken(email: string): string {
  const payload: AdminClaims = { sub: "admin", email, role: "admin" };
  return jwt.sign(payload, SECRET(), { expiresIn: "7d" });
}

export function verifyAdmin(req: VercelRequest): AdminClaims {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Unauthorized: missing token");
  try {
    const claims = jwt.verify(token, SECRET()) as AdminClaims;
    if (claims.role !== "admin") throw new Error("Unauthorized");
    return claims;
  } catch {
    throw new Error("Unauthorized: invalid token");
  }
}

export function isAdminRequest(req: VercelRequest): boolean {
  try {
    verifyAdmin(req);
    return true;
  } catch {
    return false;
  }
}

// Validate admin credentials. Prefer ADMIN_PASSWORD_HASH (bcrypt) in production.
export function checkAdminCredentials(email: string, password: string): boolean {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@toyingidea.com";
  if (email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return bcrypt.compareSync(password, hash);

  const plain = process.env.ADMIN_PASSWORD || "admin";
  return password === plain;
}
