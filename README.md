# Corsair Platform

Corsair is the integration/control platform. This repository owns credentials, connections, permissions, provider adapters, runtime APIs, agent clients, and audit.

The Job Application Assistant is not source code in this repository. It is linked locally under `clients/job-application` as a Git submodule and lives in its own repository.

MVP direction: thin composition layer around existing Corsair primitives for one Google connection, Drive upload, Sheets update, health checks, permissions, and audit. Do not reimplement Corsair credential plumbing.

## Repository layout

- `apps/corsair-admin` — minimal Corsair admin/API application
- `packages/corsair-client` — typed SDK consumed by external workloads
- `packages/shared-types` — safe cross-repository contracts
- `packages/config` — platform configuration
- `clients/job-application` — Git submodule, separate repository

## Local setup

The submodule URL is intentionally local until the GitHub repository owner/name is known. After creating the GitHub repository, update `.gitmodules` and run:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```
