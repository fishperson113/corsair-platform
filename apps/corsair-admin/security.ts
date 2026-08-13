// Pure security primitives with no Encore/runtime dependencies so they can be
// unit-tested under plain `vitest run` without a database or secret harness.
import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";

export interface SealedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

/** AES-256-GCM encrypt with an explicit 32-byte key. */
export function encryptGcm(key: Buffer, value: string): SealedPayload {
  if (key.length !== 32) throw new Error("encryption key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

/** AES-256-GCM decrypt; throws if the ciphertext/tag were tampered with. */
export function decryptGcm(key: Buffer, value: SealedPayload): string {
  if (key.length !== 32) throw new Error("encryption key must be 32 bytes");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Constant-time string comparison for secrets (avoids leaking match length via timing). */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Case-insensitive, whitespace-tolerant admin allowlist check. */
export function isAdminEmail(candidate: string, configured: string): boolean {
  const normalize = (value: string): string => value.trim().toLowerCase();
  const configuredEmail = normalize(configured);
  return configuredEmail.length > 0 && normalize(candidate) === configuredEmail;
}

/**
 * Baseline hardening headers for a personal, cookie-authenticated dashboard.
 * - CSP: only self + inline styles (the SSR pages inline <style>); no scripts,
 *   no framing (frame-ancestors), forms can only post back to self (CSRF).
 * - X-Frame-Options / nosniff / Referrer-Policy: defense in depth.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};
