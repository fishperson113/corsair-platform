# Corsair Platform / Encore Service

Corsair is implemented as an Encore.ts application. The `corsair` service exposes the minimal SSR control plane and typed JSON endpoints.

Run locally:

```bash
encore run
```

Endpoints:

- `GET /` — vanilla SSR dashboard
- `GET /health` — health probe
- `GET /integrations` — integrations page
- `GET /api/integrations` — typed integrations API
- `GET /connections`, `/clients`, `/audit`

The first hosted slice intentionally does not configure credentials or MCP. Configure those after deployment through Encore secrets/platform, as requested.
