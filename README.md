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

## Deployment

The app is registered in Encore Cloud as `corsair-platform-e542`. The managed Encore Git remote is:

```bash
git remote add encore encore://corsair-platform-e542
git push encore
```

GitHub remains the source repository for open-source development. The Job Application Assistant remains an independent repository and submodule.
