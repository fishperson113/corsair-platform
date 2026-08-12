# Architecture Boundaries

## System A — Corsair Platform

Corsair is the integration/control plane. It must not contain job, CV, candidate, cover-letter, or application lifecycle logic.

Owns:

- integration registry
- tenants and connections
- accounts and encrypted credentials
- agent clients and hashed API keys
- permissions/RBAC
- audit log
- live plugin API calls and local synced/cache DB namespaces

## System B — Job Application Assistant

Job Application Assistant is a business workload that consumes Corsair.

Owns:

- JobApplication aggregate
- CandidateProfile aggregate
- JD analysis and candidate match artifacts
- CV strategy, tailored CV, cover letter, validation report
- workflow state machine
- Telegram manager interface
- Google Sheet as projection only

## Cross-system contract

Allowed knowledge in Job Application:

- `CORSAIR_URL`
- `CORSAIR_API_KEY`
- `GOOGLE_CONNECTION_ID`
- typed Corsair client package APIs

Forbidden knowledge in Job Application:

- Google OAuth access token
- Google refresh token
- Google client secret
- raw API keys for external providers managed by Corsair

## Agent rule

LLM/Manager never directly mutates infrastructure. It emits typed tool requests; application services validate and execute them.
