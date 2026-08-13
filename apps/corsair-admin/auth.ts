import { randomBytes } from "node:crypto";
import { secret } from "encore.dev/config";
import { db } from "./database.js";
import { constantTimeEqual, decryptGcm, encryptGcm, type SealedPayload } from "./security.js";

const googleClientId = secret<"GOOGLE_CLIENT_ID">("GOOGLE_CLIENT_ID");
const googleClientSecret = secret<"GOOGLE_CLIENT_SECRET">("GOOGLE_CLIENT_SECRET");
const corsairKek = secret<"CORSAIR_KEK_BASE64">("CORSAIR_KEK_BASE64");
const adminEmail = secret<"CORSAIR_ADMIN_EMAIL">("CORSAIR_ADMIN_EMAIL");
const apiKey = secret<"CORSAIR_API_KEY">("CORSAIR_API_KEY");
const publicUrlSecret = secret<"CORSAIR_PUBLIC_URL">("CORSAIR_PUBLIC_URL");

export const ADMIN_EMAIL = "phamduong1132005@gmail.com";
export const SESSION_COOKIE = "corsair_session";
export const OAUTH_SCOPES = ["openid", "email", "profile"] as const;
export const WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

export function configuredAdminEmail(): string {
  return adminEmail() || ADMIN_EMAIL;
}

export function apiAuthorized(header: string | undefined): boolean {
  const value = header?.replace(/^Bearer\s+/i, "").trim();
  const key = apiKey();
  return Boolean(value && key && constantTimeEqual(value, key));
}

export function googleClientConfig(): { clientId: string; clientSecret: string } {
  return { clientId: googleClientId(), clientSecret: googleClientSecret() };
}

export function publicUrl(): string {
  return publicUrlSecret() || "http://127.0.0.1:4000";
}

export function callbackUrl(kind: "login" | "workspace"): string {
  return `${publicUrl()}/auth/google/${kind}/callback`;
}

function kek(): Buffer {
  const value = corsairKek();
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("CORSAIR_KEK_BASE64 must decode to 32 bytes");
  return decoded;
}

export function encrypt(value: string): SealedPayload {
  return encryptGcm(kek(), value);
}

export function decrypt(value: SealedPayload): string {
  return decryptGcm(kek(), value);
}

export async function createOAuthState(purpose: string, redirectUri: string): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  await db.exec`INSERT INTO oauth_states (state, purpose, redirect_uri, expires_at)
    VALUES (${state}, ${purpose}, ${redirectUri}, now() + interval '10 minutes')`;
  return state;
}

export async function consumeOAuthState(state: string, purpose: string): Promise<string | null> {
  const row = await db.queryRow<{ redirect_uri: string }>`DELETE FROM oauth_states
    WHERE state = ${state} AND purpose = ${purpose} AND expires_at > now()
    RETURNING redirect_uri`;
  return row?.redirect_uri ?? null;
}

export async function createSession(email: string): Promise<string> {
  const id = randomBytes(32).toString("base64url");
  await db.exec`INSERT INTO admin_sessions (id, email, expires_at)
    VALUES (${id}, ${email}, now() + interval '30 days')`;
  return id;
}

export async function sessionEmail(cookieHeader: string | undefined): Promise<string | null> {
  const id = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!id) return null;
  const row = await db.queryRow<{ email: string }>`SELECT email FROM admin_sessions
    WHERE id = ${id} AND expires_at > now()`;
  return row?.email ?? null;
}

export async function destroySession(cookieHeader: string | undefined): Promise<void> {
  const id = parseCookie(cookieHeader, SESSION_COOKIE);
  if (id) await db.exec`DELETE FROM admin_sessions WHERE id = ${id}`;
}

export function parseCookie(header: string | undefined, name: string): string | null {
  const match = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function cookieHeader(value: string, maxAge = 60 * 60 * 24 * 30): string {
  const secure = publicUrl().startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookieHeader(): string {
  const secure = publicUrl().startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

export async function audit(eventType: string, actorEmail: string | null, connectionId: string | null, metadata: Record<string, unknown> = {}): Promise<void> {
  await db.exec`INSERT INTO audit_events (event_type, actor_email, connection_id, metadata)
    VALUES (${eventType}, ${actorEmail}, ${connectionId}, ${JSON.stringify(metadata)}::jsonb)`;
}
