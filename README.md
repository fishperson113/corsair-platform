# Corsair Platform

Corsair is the integration/control platform. This repository owns credentials, connections, permissions, provider adapters, runtime APIs, agent clients, and audit.

The Job Application Assistant is not source code in this repository. It is linked locally under `clients/job-application` as a Git submodule and lives in its own repository.

The backend uses Encore.ts. Encore provides the local development runtime, API graph, tracing, and deployment path. The first slice is a minimal vanilla SSR control plane; provider credentials and MCP remain intentionally unconfigured until the platform is ready.

## Repository layout

- `apps/corsair-admin` — Encore `corsair` service with SSR dashboard and typed APIs
- `packages/corsair-client` — typed SDK consumed by external workloads
- `packages/shared-types` — safe cross-repository contracts
- `packages/config` — platform configuration
- `clients/job-application` — Git submodule, separate repository

## Local development

```bash
encore run
```

The local API is available at `http://127.0.0.1:4000` and the Encore development dashboard is available on the URL printed by the CLI.

The first implemented control-plane slice now supports personal Google access without redeployment:

- `/login` — Google sign-in restricted to `CORSAIR_ADMIN_EMAIL`.
- `/integrations` — Connect/Reconnect Google Workspace from the UI.
- `/connections` — view account/status and Disconnect without exposing tokens.
- OAuth state is single-use and expires after ten minutes.
- Workspace credentials are encrypted with AES-256-GCM using `CORSAIR_KEK_BASE64` before persistence.
- `@corsair-platform/client` exposes only safe connection summaries and health checks; it never models provider tokens.

Required Encore secrets:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CORSAIR_ADMIN_EMAIL=phamduong1132005@gmail.com
CORSAIR_PUBLIC_URL=https://<corsair-public-host>
CORSAIR_KEK_BASE64=<base64 of a 32-byte key>
CORSAIR_API_KEY=<long random key for workload SDK calls>
```

Google OAuth redirect URIs must include:

```text
https://<corsair-public-host>/auth/google/login/callback
https://<corsair-public-host>/auth/google/workspace/callback
```

For local development, use `CORSAIR_PUBLIC_URL=http://127.0.0.1:4000` and register the two localhost callback URLs in the Google OAuth client.

The app is registered in Encore Cloud as `corsair-platform-e542` and is linked to GitHub. Push changes to GitHub `main`; do not use the legacy managed Encore remote.
