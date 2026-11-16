// The session lives in one cookie, sealed with AES-256-GCM: nobody can read it (it holds the
// user's GitHub token) or change it without the session secret. No database, no server state.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type Session = {
  login: string;
  name?: string;
  /** The user-to-server token from signing in through the GitHub App ("way B"). */
  token: string;
  /** Seconds since the epoch after which the session is refused. */
  expires: number;
};

const key = (secret: string) => createHash("sha256").update(secret).digest();

export function seal(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(sealed: string | undefined, secret: string): T | undefined {
  if (!sealed) return undefined;
  try {
    const raw = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

export function openSession(sealed: string | undefined, secret: string, now = Date.now()): Session | undefined {
  const s = unseal<Session>(sealed, secret);
  return s && typeof s.login === "string" && typeof s.token === "string" && s.expires * 1000 > now ? s : undefined;
}

export function cookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
