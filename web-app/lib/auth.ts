import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "crypto";

const COOKIE_NAME = "ls_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET missing or too short");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueSession(email: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

export function getSession(): { email: string } | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export function requireSession() {
  const s = getSession();
  if (!s) redirect("/login");
  return s;
}

/**
 * Password hashing — scrypt (Node built-in, no native deps needed on Vercel).
 * Format: `scrypt:<salt_b64url>:<hash_b64url>`
 * Uses `:` (not `$`) and base64url (no `+/=` chars) so the hash survives
 * .env file parsing without any quoting.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
