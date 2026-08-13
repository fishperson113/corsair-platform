import { api } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";
import { audit as writeAudit, apiAuthorized, callbackUrl, clearCookieHeader, configuredAdminEmail, consumeOAuthState, cookieHeader, createOAuthState, createSession, destroySession, encrypt, googleClientConfig, OAUTH_SCOPES, publicUrl, SESSION_COOKIE, sessionEmail, WORKSPACE_SCOPES } from "./auth.js";
import { db } from "./database.js";
import { exchangeCode, googleAuthorizationUrl, googleProfile } from "./google.js";
import { addTelegramBot, disconnectTelegramBot, telegramOwner, testTelegramBot } from "./telegram.js";

const styles = `
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#0b1020;color:#e8ecf7}*{box-sizing:border-box}body{margin:0;min-width:320px}a{color:inherit;text-decoration:none}.shell{display:grid;grid-template-columns:230px 1fr;min-height:100vh}.sidebar{border-right:1px solid #202a43;padding:24px 16px;background:#0d1428}.brand{font-weight:800;letter-spacing:.08em;margin:0 8px 32px}.nav a{display:block;padding:10px 12px;border-radius:8px;color:#aab5cf;margin:4px 0}.nav a:hover,.nav a.active{background:#182442;color:#fff}.main{padding:32px;max-width:1280px;width:100%}.header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:28px}h1{margin:0;font-size:28px}h2{font-size:18px;margin:0 0 16px}.muted{color:#93a0bd}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:24px}.card{background:#111a30;border:1px solid #202a43;border-radius:12px;padding:18px}.metric{font-size:30px;font-weight:800;margin-top:8px}.table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:13px 10px;border-bottom:1px solid #202a43}th{color:#93a0bd;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.badge{display:inline-block;padding:4px 9px;border-radius:99px;font-size:12px;background:#173d31;color:#81e6bb}.badge.warn{background:#453514;color:#ffd479}@media(max-width:800px){.shell{grid-template-columns:1fr}.sidebar{border-right:0;border-bottom:1px solid #202a43}.nav{display:flex;overflow:auto}.main{padding:20px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

const nav = (active: string) => [
  ["dashboard", "Dashboard", "/"], ["integrations", "Integrations", "/integrations"],
  ["connections", "Connections", "/connections"], ["clients", "Agent clients", "/clients"], ["audit", "Audit log", "/audit"],
].map(([id, label, href]) => `<a class="${active === id ? "active" : ""}" href="${href}">${label}</a>`).join("");

function page(title: string, body: string, active = "dashboard"): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Corsair</title><style>${styles}</style></head><body><div class="shell"><aside class="sidebar"><div class="brand">CORSAIR</div><nav class="nav">${nav(active)}</nav></aside><main class="main">${body}</main></div></body></html>`;
}

function sendHtml(res: ServerResponse, html: string, status = 200): void {
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(html);
}

function sendJson(res: ServerResponse, value: unknown): void {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

export const health = api(
  { method: "GET", path: "/health", expose: true },
  async (): Promise<{ status: string; system: string; version: string }> => ({ status: "ok", system: "corsair-platform", version: "0.1.0" }),
);

export const integrations = api(
  { method: "GET", path: "/api/integrations", expose: true },
  async (): Promise<{ integrations: Array<{ id: string; name: string; status: string; account: string }> }> => ({
    integrations: [
      { id: "google-workspace", name: "Google Workspace", status: "Not connected", account: "Configure in Corsair" },
      { id: "telegram", name: "Telegram", status: "Not connected", account: "Configure in Corsair" },
    ],
  }),
);

export const connections = api.raw({ method: "GET", path: "/api/connections", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  if (!apiAuthorized(req.headers.authorization)) {
    res.statusCode = 401;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  const rows = await db.queryAll<{ id: string; provider: string; account_email: string; status: string; scopes: string[] }>`SELECT id, provider, account_email, status, scopes FROM connections ORDER BY updated_at DESC`;
  sendJson(res, { connections: rows.map((row) => ({ id: row.id, provider: row.provider, account: row.account_email, status: row.status, scopes: row.scopes })) });
});
export const clients = api({ method: "GET", path: "/api/clients", expose: true }, async (): Promise<{ clients: unknown[] }> => ({ clients: [] }));
export const audit = api({ method: "GET", path: "/api/audit", expose: true }, async (): Promise<{ events: unknown[] }> => ({ events: [] }));

export const dashboard = api.raw({ method: "GET", path: "/", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => {
  sendHtml(res, page("Dashboard", `<div class="header"><div><h1>Corsair Platform</h1><div class="muted">Integration control plane · Encore MVP</div></div><span class="badge">API healthy</span></div><div class="grid"><div class="card"><div class="muted">Connected integrations</div><div class="metric">0</div></div><div class="card"><div class="muted">Healthy connections</div><div class="metric">0</div></div><div class="card"><div class="muted">Agent clients</div><div class="metric">0</div></div><div class="card"><div class="muted">Audit events</div><div class="metric">0</div></div></div><h2>Next step</h2><div class="card"><p class="muted">Corsair is running on Encore with a minimal SSR dashboard. Configure credentials, integrations, and MCP connections from the platform after deployment.</p></div>`));
});

export const integrationsPage = api.raw({ method: "GET", path: "/integrations", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  const connection = await db.queryRow<{ account_email: string; status: string }>`SELECT account_email, status FROM connections WHERE id = 'google-personal'`;
  const status = connection?.status || "Not connected";
  const action = connection ? "Reconnect" : "Connect";
  sendHtml(res, page("Integrations", `<div class="header"><div><h1>Integrations</h1><div class="muted">Signed in as ${escapeHtml(email)}</div></div><a class="badge" href="/auth/logout">Sign out</a></div><div class="card"><table class="table"><thead><tr><th>Name</th><th>Status</th><th>Account</th><th>Action</th></tr></thead><tbody><tr><td>Google Workspace</td><td><span class="badge ${status === "healthy" ? "" : "warn"}">${escapeHtml(status)}</span></td><td>${escapeHtml(connection?.account_email || "Not connected")}</td><td><a class="badge" href="/auth/google/workspace/start">${action}</a></td></tr><tr><td>Telegram</td><td><span class="badge warn">Not connected</span></td><td>—</td><td><a class="badge" href="/telegram">Manage bots</a></td></tr></tbody></table></div>`, "integrations"));
});

export const connectionsPage = api.raw({ method: "GET", path: "/connections", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  const connection = await db.queryRow<{ account_email: string; status: string }>`SELECT account_email, status FROM connections WHERE id = 'google-personal'`;
  const body = connection
    ? `<div class="header"><div><h1>Connections</h1><div class="muted">Signed in as ${escapeHtml(email)}</div></div></div><div class="card"><table class="table"><thead><tr><th>Provider</th><th>Account</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr><td>Google Workspace</td><td>${escapeHtml(connection.account_email)}</td><td><span class="badge">${escapeHtml(connection.status)}</span></td><td><a class="badge" href="/auth/google/workspace/start">Reconnect</a> <form method="post" action="/connections/google-personal/disconnect" style="display:inline"><button class="badge warn" type="submit">Disconnect</button></form></td></tr></tbody></table></div>`
    : `<div class="header"><div><h1>Connections</h1><div class="muted">Signed in as ${escapeHtml(email)}</div></div></div><div class="card"><p class="muted">No connections configured.</p><p><a class="badge" href="/auth/google/workspace/start">Connect Google Workspace</a></p></div>`;
  sendHtml(res, page("Connections", body, "connections"));
});
export const clientsPage = api.raw({ method: "GET", path: "/clients", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => sendHtml(res, page("Agent clients", `<div class="header"><div><h1>Agent clients</h1><div class="muted">Workloads consume Corsair through scoped clients.</div></div></div><div class="card"><p class="muted">No agent clients registered.</p></div>`, "clients")));
export const auditPage = api.raw({ method: "GET", path: "/audit", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => sendHtml(res, page("Audit log", `<div class="header"><div><h1>Audit log</h1><div class="muted">External side effects will appear here.</div></div></div><div class="card"><p class="muted">No audit events yet.</p></div>`, "audit")));

export const telegramPage = api.raw({ method: "GET", path: "/telegram", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  const bots = await db.queryAll<{ id: string; username: string; display_name: string; status: string }>`SELECT id, username, display_name, status FROM telegram_bots ORDER BY created_at`;
  const rows = bots.length > 0
    ? bots.map((bot) => `<tr><td>${escapeHtml(bot.display_name)}</td><td>@${escapeHtml(bot.username)}</td><td><span class="badge ${bot.status === "healthy" ? "" : "warn"}">${escapeHtml(bot.status)}</span></td><td><form method="post" action="/telegram/bots/${encodeURIComponent(bot.id)}/test" style="display:inline"><button class="badge" type="submit">Test</button></form> <form method="post" action="/telegram/bots/${encodeURIComponent(bot.id)}/disconnect" style="display:inline"><button class="badge warn" type="submit">Disconnect</button></form></td></tr>`).join("")
    : `<tr><td colspan="4" class="muted">No Telegram bots connected.</td></tr>`;
  sendHtml(res, page("Telegram", `<div class="header"><div><h1>Telegram</h1><div class="muted">Owner: @${telegramOwner.username} · ${telegramOwner.firstName} ${telegramOwner.lastName}</div></div></div><div class="card"><h2>Connected bots</h2><table class="table"><thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div><div class="card"><h2>Add bot</h2><p class="muted">Create a bot with @BotFather, then paste its token here. The token is encrypted server-side and never shown again.</p><form method="post" action="/telegram/bots"><p><label>Display name<br><input name="display_name" required maxlength="100"></label></p><p><label>Bot token<br><input name="token" type="password" required autocomplete="off"></label></p><button class="badge" type="submit">Connect bot</button></form></div>`, "integrations"));
});

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

export const addTelegram = api.raw({ method: "POST", path: "/telegram/bots", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  try {
    const form = await readForm(req);
    await addTelegramBot(form.get("token") || "", form.get("display_name") || "");
    redirect(res, "/telegram");
  } catch (error) {
    sendHtml(res, page("Telegram error", `<div class="card"><p>${escapeHtml(error instanceof Error ? error.message : "Cannot connect Telegram bot")}</p><p><a class="badge" href="/telegram">Back</a></p></div>`), 400);
  }
});

export const testTelegram = api.raw({ method: "POST", path: "/telegram/bots/:id/test", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  const id = (req.url || "").split("/").at(-2) || "";
  await testTelegramBot(decodeURIComponent(id));
  redirect(res, "/telegram");
});

export const disconnectTelegram = api.raw({ method: "POST", path: "/telegram/bots/:id/disconnect", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  const id = (req.url || "").split("/").at(-2) || "";
  await disconnectTelegramBot(decodeURIComponent(id));
  redirect(res, "/telegram");
});

export const disconnectGoogle = api.raw({ method: "POST", path: "/connections/google-personal/disconnect", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  await db.exec`UPDATE connections SET status = 'disconnected', updated_at = now() WHERE id = 'google-personal'`;
  await writeAudit("connection.google.disconnected", email, "google-personal");
  redirect(res, "/connections");
});

function redirect(res: ServerResponse, location: string, headers: Record<string, string> = {}): void {
  res.statusCode = 302;
  res.setHeader("location", location);
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] || char);
}

function query(req: IncomingMessage): URLSearchParams {
  return new URL(req.url || "/", publicUrl()).searchParams;
}

function oauthError(res: ServerResponse, message: string): void {
  sendHtml(res, page("OAuth error", `<div class="header"><h1>Connection failed</h1></div><div class="card"><p>${escapeHtml(message)}</p><p><a class="badge" href="/integrations">Back to Integrations</a></p></div>`), 400);
}

export const loginPage = api.raw({ method: "GET", path: "/login", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => {
  sendHtml(res, page("Sign in", `<div class="header"><div><h1>Corsair Platform</h1><div class="muted">Personal control plane</div></div></div><div class="card"><p class="muted">Sign in with the allowlisted Google account to manage integrations.</p><p><a class="badge" href="/auth/google/login/start">Continue with Google</a></p></div>`));
});

export const googleLoginStart = api.raw({ method: "GET", path: "/auth/google/login/start", expose: true }, async (_req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const redirectUri = callbackUrl("login");
    const state = await createOAuthState("admin_login", redirectUri);
    redirect(res, await googleAuthorizationUrl({ state, redirectUri, scopes: OAUTH_SCOPES, accessType: "online", prompt: "select_account" }));
  } catch (error) {
    oauthError(res, error instanceof Error ? error.message : "Cannot start Google login");
  }
});

export const googleLoginCallback = api.raw({ method: "GET", path: "/auth/google/login/callback", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    const params = query(req);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return oauthError(res, "Google did not return an authorization code");
    const redirectUri = await consumeOAuthState(state, "admin_login");
    if (!redirectUri) return oauthError(res, "OAuth state expired or was already used");
    const tokens = await exchangeCode(code, redirectUri);
    const profile = await googleProfile(tokens.access_token);
    if (profile.email.toLowerCase() !== configuredAdminEmail().toLowerCase()) return oauthError(res, "This Google account is not the Corsair admin account");
    const session = await createSession(profile.email);
    await writeAudit("admin.login", profile.email, null, { provider: "google" });
    redirect(res, "/", { "set-cookie": cookieHeader(session) });
  } catch (error) {
    oauthError(res, error instanceof Error ? error.message : "Google login failed");
  }
});

export const logout = api.raw({ method: "GET", path: "/auth/logout", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  await destroySession(req.headers.cookie);
  if (email) await writeAudit("admin.logout", email, null);
  redirect(res, "/login", { "set-cookie": clearCookieHeader() });
});

export const googleWorkspaceStart = api.raw({ method: "GET", path: "/auth/google/workspace/start", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  try {
    const redirectUri = callbackUrl("workspace");
    const state = await createOAuthState("workspace_connect", redirectUri);
    redirect(res, await googleAuthorizationUrl({ state, redirectUri, scopes: [...OAUTH_SCOPES, ...WORKSPACE_SCOPES], accessType: "offline", prompt: "consent" }));
  } catch (error) {
    oauthError(res, error instanceof Error ? error.message : "Cannot start Workspace connection");
  }
});

export const googleWorkspaceCallback = api.raw({ method: "GET", path: "/auth/google/workspace/callback", expose: true }, async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const email = await sessionEmail(req.headers.cookie);
  if (!email) return redirect(res, "/login");
  try {
    const params = query(req);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return oauthError(res, "Google did not return an authorization code");
    const redirectUri = await consumeOAuthState(state, "workspace_connect");
    if (!redirectUri) return oauthError(res, "OAuth state expired or was already used");
    const tokens = await exchangeCode(code, redirectUri);
    const profile = await googleProfile(tokens.access_token);
    const existing = await db.queryRow<{ credential_ciphertext: string; credential_iv: string; credential_tag: string }>`SELECT credential_ciphertext, credential_iv, credential_tag FROM connections WHERE id = 'google-personal'`;
    let refreshToken = tokens.refresh_token;
    if (!refreshToken && existing) {
      const previous = JSON.parse((await import("./auth.js")).decrypt({ ciphertext: existing.credential_ciphertext, iv: existing.credential_iv, tag: existing.credential_tag })) as { refresh_token?: string };
      refreshToken = previous.refresh_token;
    }
    if (!refreshToken) return oauthError(res, "Google did not return a refresh token; choose the account again and approve offline access");
    const credential = encrypt(JSON.stringify({ access_token: tokens.access_token, refresh_token: refreshToken, expires_in: tokens.expires_in, scope: tokens.scope }));
    await db.exec`INSERT INTO connections (id, provider, account_email, account_id, status, scopes, credential_ciphertext, credential_iv, credential_tag)
      VALUES ('google-personal', 'google', ${profile.email}, ${profile.sub}, 'healthy', ${[...WORKSPACE_SCOPES]}, ${credential.ciphertext}, ${credential.iv}, ${credential.tag})
      ON CONFLICT (id) DO UPDATE SET account_email = EXCLUDED.account_email, account_id = EXCLUDED.account_id, status = 'healthy', scopes = EXCLUDED.scopes, credential_ciphertext = EXCLUDED.credential_ciphertext, credential_iv = EXCLUDED.credential_iv, credential_tag = EXCLUDED.credential_tag, updated_at = now()`;
    await writeAudit("connection.google.connected", email, "google-personal", { accountEmail: profile.email });
    redirect(res, "/integrations");
  } catch (error) {
    oauthError(res, error instanceof Error ? error.message : "Google Workspace connection failed");
  }
});

void googleClientConfig;
void SESSION_COOKIE;
void sendJson;
