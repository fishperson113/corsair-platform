# Corsair Platform

Minimal SSR admin/API for the Corsair integration control plane.

Run locally after installing dependencies:

```bash
npm run dev:admin
```

Health endpoint:

```text
GET /health
```

This first hosted slice intentionally does not configure credentials or MCP. Configure those after deployment through the platform, as requested.
