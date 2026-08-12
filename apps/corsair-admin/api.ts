import { api } from "encore.dev/api";
import type { IncomingMessage, ServerResponse } from "node:http";

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

export const connections = api({ method: "GET", path: "/api/connections", expose: true }, async (): Promise<{ connections: unknown[] }> => ({ connections: [] }));
export const clients = api({ method: "GET", path: "/api/clients", expose: true }, async (): Promise<{ clients: unknown[] }> => ({ clients: [] }));
export const audit = api({ method: "GET", path: "/api/audit", expose: true }, async (): Promise<{ events: unknown[] }> => ({ events: [] }));

export const dashboard = api.raw({ method: "GET", path: "/", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => {
  sendHtml(res, page("Dashboard", `<div class="header"><div><h1>Corsair Platform</h1><div class="muted">Integration control plane · Encore MVP</div></div><span class="badge">API healthy</span></div><div class="grid"><div class="card"><div class="muted">Connected integrations</div><div class="metric">0</div></div><div class="card"><div class="muted">Healthy connections</div><div class="metric">0</div></div><div class="card"><div class="muted">Agent clients</div><div class="metric">0</div></div><div class="card"><div class="muted">Audit events</div><div class="metric">0</div></div></div><h2>Next step</h2><div class="card"><p class="muted">Corsair is running on Encore with a minimal SSR dashboard. Configure credentials, integrations, and MCP connections from the platform after deployment.</p></div>`));
});

export const integrationsPage = api.raw({ method: "GET", path: "/integrations", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => {
  sendHtml(res, page("Integrations", `<div class="header"><div><h1>Integrations</h1><div class="muted">Provider registry and capability status</div></div></div><div class="card"><table class="table"><thead><tr><th>Name</th><th>Status</th><th>Account</th></tr></thead><tbody><tr><td>Google Workspace</td><td><span class="badge warn">Not connected</span></td><td>Configure in Corsair</td></tr><tr><td>Telegram</td><td><span class="badge warn">Not connected</span></td><td>Configure in Corsair</td></tr></tbody></table></div>`, "integrations"));
});

export const connectionsPage = api.raw({ method: "GET", path: "/connections", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => sendHtml(res, page("Connections", `<div class="header"><div><h1>Connections</h1><div class="muted">Credentials are intentionally not displayed.</div></div></div><div class="card"><p class="muted">No connections configured. Add OAuth/API credentials from the Corsair control plane.</p></div>`, "connections")));
export const clientsPage = api.raw({ method: "GET", path: "/clients", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => sendHtml(res, page("Agent clients", `<div class="header"><div><h1>Agent clients</h1><div class="muted">Workloads consume Corsair through scoped clients.</div></div></div><div class="card"><p class="muted">No agent clients registered.</p></div>`, "clients")));
export const auditPage = api.raw({ method: "GET", path: "/audit", expose: true }, (_req: IncomingMessage, res: ServerResponse): void => sendHtml(res, page("Audit log", `<div class="header"><div><h1>Audit log</h1><div class="muted">External side effects will appear here.</div></div></div><div class="card"><p class="muted">No audit events yet.</p></div>`, "audit")));

void sendJson;
