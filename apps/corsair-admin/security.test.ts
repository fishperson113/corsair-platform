import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { constantTimeEqual, decryptGcm, encryptGcm, isAdminEmail, SECURITY_HEADERS } from "./security.js";

const key = randomBytes(32);

describe("encryptGcm / decryptGcm", () => {
  it("round-trips a value through encrypt then decrypt", () => {
    const secret = "botfather:123456:AAExample-Token";
    const sealed = encryptGcm(key, secret);
    expect(sealed.ciphertext).not.toContain(secret);
    expect(decryptGcm(key, sealed)).toBe(secret);
  });

  it("uses a fresh IV so identical plaintext yields different ciphertext", () => {
    const a = encryptGcm(key, "same");
    const b = encryptGcm(key, "same");
    expect(a.ciphertext === b.ciphertext && a.iv === b.iv).toBe(false);
  });

  it("rejects a tampered ciphertext via the auth tag", () => {
    const sealed = encryptGcm(key, "sensitive");
    const forged = Buffer.from(sealed.ciphertext, "base64url");
    forged[0] ^= 0x01;
    expect(() => decryptGcm(key, { ...sealed, ciphertext: forged.toString("base64url") })).toThrow();
  });

  it("fails to decrypt under a different key", () => {
    const sealed = encryptGcm(key, "sensitive");
    expect(() => decryptGcm(randomBytes(32), sealed)).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => encryptGcm(randomBytes(16), "x")).toThrow();
  });
});

describe("constantTimeEqual", () => {
  it("matches identical secrets", () => {
    expect(constantTimeEqual("api-key-abc", "api-key-abc")).toBe(true);
  });

  it("rejects different secrets and length mismatches without throwing", () => {
    expect(constantTimeEqual("api-key-abc", "api-key-xyz")).toBe(false);
    expect(constantTimeEqual("short", "longer-value")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("isAdminEmail", () => {
  it("accepts the configured admin regardless of case or surrounding whitespace", () => {
    expect(isAdminEmail("Owner@Example.com", "owner@example.com")).toBe(true);
    expect(isAdminEmail("  owner@example.com  ", "owner@example.com")).toBe(true);
  });

  it("rejects any other account and an empty allowlist", () => {
    expect(isAdminEmail("intruder@example.com", "owner@example.com")).toBe(false);
    expect(isAdminEmail("anyone@example.com", "")).toBe(false);
  });
});

describe("SECURITY_HEADERS", () => {
  it("blocks framing and restricts form posts to self", () => {
    expect(SECURITY_HEADERS["x-frame-options"]).toBe("DENY");
    expect(SECURITY_HEADERS["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(SECURITY_HEADERS["content-security-policy"]).toContain("form-action 'self'");
  });
});
