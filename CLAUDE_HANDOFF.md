# Claude Handoff — Corsair Platform

Updated after the Telegram MVP and product-intent handoff.

## Mission

Continue building Corsair as the integration/control plane for personal agent workloads.

Corsair owns:

- provider/integration registry;
- connection lifecycle;
- encrypted provider credentials;
- provider adapters and runtime API calls;
- agent clients/API keys;
- permissions/capabilities;
- audit events.

The Job Application Assistant is a separate repository and is included only as the Git submodule:

```text
clients/job-application
```

Do not move Job Application domain logic into Corsair.

## User story and product intent

This is a personal-first platform, not a generic SaaS product at the current stage.

The owner wants to operate one personal agent system from Telegram while keeping provider credentials behind Corsair:

```text
Owner's Telegram profile: @FishPerson123
        ↓
Job Application Assistant / other personal workloads
        ↓
Corsair connectionId-based client
        ↓
Google Workspace, Telegram bots, and future providers
```

### Primary user story

As the owner, I want to open the Corsair web dashboard, connect or reconnect my Google Workspace account and manage multiple Telegram bots from the UI, so that I never need to paste provider credentials into source code, edit production `.env`, or redeploy just to change an account or bot.

### Job Application Assistant story

As the owner, I want to send a job-description URL through one of my Telegram bots, then have the separate Job Application Assistant:

1. receive and normalize the job description;
2. create or detect a duplicate JobApplication;
3. analyze responsibilities, requirements, seniority, keywords, and hiring signals;
4. load the canonical candidate profile and evidence;
5. produce a grounded candidate-to-job match report;
6. select a CV strategy and generate a tailored CV;
7. generate a cover letter;
8. validate claims and outputs against candidate evidence;
9. render/compile the CV and cover letter to PDF;
10. store artifacts in Google Drive through Corsair;
11. update the job tracker/projection in Google Sheets through Corsair;
12. notify the owner through Telegram.

The workload owns job applications, candidate data, analysis, documents, workflow state, and Telegram user experience. Corsair owns the external integration credentials and provider calls.

### Telegram intent

The owner has one primary Telegram profile, but may operate many bots. The primary profile is owner metadata only; Corsair must not log into the personal Telegram account and must not create an MTProto session unless the owner explicitly changes this decision.

Bots are added individually through the Corsair UI using BotFather tokens. A bot token is a provider credential: it is encrypted server-side, never returned to the browser, and accessed by workloads only through a scoped `connectionId`.

### Google intent

Google Workspace is connected through browser OAuth. The owner approves access in Google's consent screen; Corsair stores the encrypted refresh credential and handles future refresh/runtime calls. The Job Application Assistant receives only a connection ID such as `google-personal`, never Google tokens or client secrets.

### Product principles

- Personal-first and simple before multi-tenant generalization.
- UI-managed connections; no manual credential editing or redeploy for normal reconnects.
- Separate platform/control plane from workload/business domain.
- Human-owned provider connections and explicit capability boundaries.
- No raw provider credentials in browser responses, SDK types, Job Application source, or LLM prompts.
- Provider-independent workload contracts; Google/Telegram SDK details stay inside Corsair adapters.
- Keep the workload repository independent and releaseable; use the platform repository submodule only for coordinated local development.


- Repository: `C:\workspace\corsair-platform`
- Branch: `main`
- GitHub remote: `origin`
- Encore Cloud app: `corsair-platform-e542`
- Staging URL: `https://staging-corsair-platform-e542.encr.app`
- Deployment rule: push GitHub `main`; do not use `git push encore`.
- Last feature commit: `fc84a49 feat: add provider runtime seam for workloads`
- Security hardening commit: `8914781 feat: harden admin control plane security`
- Multi-bot Telegram commit: `e4ab318 feat: add multi-bot Telegram connections`

The worktree was clean before this handoff file was created.

## Implemented and verified

### Encore service and persistence

- Encore service: `apps/corsair-admin/encore.service.ts`, service name `corsair`.
- SQL database: `apps/corsair-admin/database.ts`.
- Migrations:
  - `migrations/001_create_control_plane.up.sql`
  - `migrations/002_add_telegram_bots.up.sql`
- `encore check` has passed locally and applied both migrations in the local Encore database.

Current tables:

```text
oauth_states
admin_sessions
connections
audit_events
telegram_bots
```

### Single-user admin access

Google OAuth is used only for Corsair admin UI access. The allowlisted admin email is:

```text
phamduong1132005@gmail.com
```

Routes:

```text
/login
/auth/google/login/start
/auth/google/login/callback
/auth/logout
```

Sessions are stored server-side in `admin_sessions`. The browser receives an HttpOnly cookie. Local HTTP does not set `Secure`; HTTPS production does.

### Google Workspace connection

UI routes:

```text
/integrations
/connections
```

Features:

- Connect Google Workspace from the UI.
- Reconnect.
- Disconnect.
- Single-use OAuth state with ten-minute expiry.
- Google access/refresh token payload encrypted with AES-256-GCM before persistence.
- Raw tokens are never returned to the UI.

Connection ID currently used by the personal workload:

```text
google-personal
```

### Telegram ownership model

Corsair does NOT log into the Telegram personal account. There is no OTP, MTProto session, or Telegram logout flow.

The personal Telegram profile is owner metadata:

```text
username: FishPerson123
telegram user id: 5083029113
first name: Dương
last name: Phạm
language: en
```

Telegram bots are independent Bot API connections. Each bot has its own encrypted BotFather token.

UI route:

```text
/telegram
```

Features:

- Add multiple bots.
- Verify a token by calling Telegram `getMe`.
- Encrypt and persist the token server-side.
- Display bot username and status without displaying token.
- Test a stored bot token.
- Disconnect a bot.

Telegram implementation:

```text
apps/corsair-admin/telegram.ts
apps/corsair-admin/migrations/002_add_telegram_bots.up.sql
```

### SDK boundary

`packages/corsair-client/src/index.ts` is no longer an empty placeholder.

It currently exposes:

```ts
CorsairClient.health()
CorsairClient.listConnections()
CorsairClient.sendTelegramMessage({ connectionId, chatId, text, ... })
CorsairClient.getTelegramUpdates({ connectionId, offset?, limit?, timeout? })
CorsairClient.uploadDriveFile({ connectionId, name, mimeType, contentBase64, parents? })
CorsairClient.appendSheetRows({ connectionId, spreadsheetId, range, values })
CorsairClient.getSheetValues({ connectionId, spreadsheetId, range })
```

The client models safe connection summaries and provider operations addressed only by `connectionId`. It must never model Google refresh tokens, Telegram bot tokens, OAuth client secrets, or other raw provider credentials.

### Workload provider API (runtime seam)

Bearer-authed (`CORSAIR_API_KEY`) endpoints that make provider calls on a workload's behalf. All live and verified on staging (401 without/with wrong key):

```text
POST /api/telegram/send            -> Bot API sendMessage
POST /api/telegram/updates         -> Bot API getUpdates (no webhook, no MTProto)
POST /api/google/drive/upload      -> Drive multipart upload
POST /api/google/sheets/append     -> Sheets values append
POST /api/google/sheets/get        -> Sheets values get
```

Implementation:

```text
apps/corsair-admin/workload-api.ts        (Bearer-authed endpoints)
apps/corsair-admin/telegram.ts            (sendTelegramMessage, getTelegramUpdates)
apps/corsair-admin/google-runtime.ts      (accessTokenFor, driveUpload, sheetsAppend, sheetsGet)
apps/corsair-admin/google.ts              (refreshAccessToken)
apps/corsair-admin/provider-encoding.ts   (pure buildDriveMultipart)
apps/corsair-admin/security.ts            (pure crypto/compare/allowlist/headers)
```

Google access tokens are refreshed server-side per call from the stored refresh token; a failed refresh flips the connection to `needs_reauth`. Telegram inbound uses `getUpdates` polling (caller manages the offset), chosen over webhooks for single-user simplicity.

### Cloud smoke evidence

The following staging probes have passed:

```text
GET /health                         -> 200
GET /login                          -> 200
GET /integrations without session  -> 302 /login
GET /connections without session   -> 302 /login
GET /telegram without session      -> 302 /login
GET /api/connections without key   -> 401 unauthorized
```

OAuth start on staging returned a Google URL containing the configured client ID and the correct staging callback URL. The user manually connected Google and added a Telegram bot through the staging UI.

A browser/curl session owned by Claude cannot inspect the user's HttpOnly session cookie. Do not interpret a redirect to `/login` in a separate browser context as proof that the user's connection disappeared.

## Encore secrets

Sensitive/runtime configuration must use Encore `secret()`, not production `.env` files.

Required secret names:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
CORSAIR_ADMIN_EMAIL
CORSAIR_PUBLIC_URL
CORSAIR_KEK_BASE64
CORSAIR_API_KEY
```

Expected staging values include:

```text
CORSAIR_ADMIN_EMAIL=phamduong1132005@gmail.com
CORSAIR_PUBLIC_URL=https://staging-corsair-platform-e542.encr.app
```

Google redirect URIs:

```text
https://staging-corsair-platform-e542.encr.app/auth/google/login/callback
https://staging-corsair-platform-e542.encr.app/auth/google/workspace/callback
```

`CORSAIR_KEK_BASE64` must remain stable after credentials are stored. Do not regenerate it casually. Never print or commit secret values.

`CORSAIR_API_KEY` is the workload-to-Corsair Bearer key. It is not a Google key and must be configured in the consuming workload separately.

## Important incomplete areas

Corsair is NOT a finished integration platform. It is currently a working personal connection-control-plane MVP.

Closed since last handoff:

- P1 security pass: constant-time API-key compare, AES-256-GCM extracted to a pure testable core, hardening headers (CSP `form-action 'self'` + `frame-ancestors 'none'`, X-Frame-Options DENY, nosniff, no-referrer) on every response. Single-user posture: SameSite=Lax + CSP is the CSRF stance; no CSRF token store, no rate limiter (login is Google OAuth restricted to one allowlisted email).
- SDK now exposes Telegram send/updates and Google Drive/Sheets operations (gate 1).
- Telegram outbound sendMessage + inbound getUpdates implemented (gate 2, via polling not webhook).
- Google refresh-token exchange + Drive/Sheets runtime adapters implemented (gate 3).
- Focused unit tests exist: encryption round-trip/tamper, constant-time compare, admin allowlist, Drive multipart encoding, SDK request shaping (18 tests, real `vitest run`).

Unclosed gates:

1. Telegram lacks webhook ingress, update persistence, retries/backoff, and idempotency. `getUpdates` polling is intentional for single-user; revisit if a bot needs push delivery or multiple consumers.
2. Google access tokens are refreshed per call (no caching) and there is no periodic connection health check beyond the on-call `needs_reauth` transition.
3. Provider endpoints have no per-operation rate limiting or request-size caps (single-user, accepted for now).
4. Agent client creation, revocation, scoped permissions, and capability enforcement are not implemented. Today any holder of `CORSAIR_API_KEY` can call every connection.
5. `/api/clients` and `/api/audit` are still placeholder endpoints; audit rows are written (including for provider calls now) but there is no query UI/API.
6. `api.ts` still holds the admin SSR surface; the provider/security/runtime concerns are now split into their own modules, but auth/session/connection contexts could be split further before adding many more providers.

Do not claim Corsair is complete until these gates are addressed or explicitly accepted as out of scope. The provider runtime seam (gate 10 in the previous handoff) is now built, so the platform is ready for the Job Application client to consume Corsair only through the SDK.

## Recommended next implementation order

### P1 — Stabilize security and boundaries

- Extract auth/session, connection, credential, audit, and provider modules from `api.ts`.
- Add explicit admin authorization middleware to every management route.
- Add CSRF protection for POST form routes.
- Add rate limiting for login/OAuth start and bot-token verification.
- Add focused tests for encryption round-trip, OAuth state expiry/replay, admin allowlist, and unauthorized routes.

### P2 — Finish Telegram Bot API runtime

- Store webhook configuration per bot.
- Add `setWebhook`, `deleteWebhook`, and `getWebhookInfo` helpers.
- Add inbound update endpoint with Telegram secret-token verification.
- Persist update ID/idempotency state.
- Add safe outbound `sendMessage` operation through `connectionId`.
- Add retry/backoff and audit event for external side effects.

### P3 — Finish Google runtime adapters

- Implement refresh-token exchange server-side.
- Add typed Drive and Sheets operations selected by `connectionId`.
- Route all external calls through provider adapters.
- Add connection health checks and `needs_reauth` transitions.

### P4 — Finish Corsair client and workload seam

- Define typed provider-neutral operation request/response contracts.
- Add connection-scoped client methods.
- Update Job Application to call Corsair only through the published/versioned client boundary.
- Never add provider tokens or direct Telegram/Google SDK plumbing to Job Application.

### P5 — Agent clients, permissions, audit

- Create/revoke agent clients.
- Hash API keys; show raw key only once at creation.
- Enforce integration/resource/action capabilities at the runtime boundary.
- Add queryable audit log with actor, connection, operation, result, and external request metadata.

## Verification commands

This is a TypeScript/npm/Encore repository, not a Python/uv repository.

Run without dependency mutation:

```bash
npm run typecheck
npm test
encore check
git diff --check
```

`npm test` currently reports no test files; report that honestly.

For deployment, commit and push GitHub `main`. Do not push the managed `encore` remote.

## Safety rules for Claude

- Do not print, ask the user to paste, or commit Google client secrets, refresh tokens, Telegram bot tokens, KEK values, or API keys.
- Do not regenerate `CORSAIR_KEK_BASE64` when existing connections may depend on it.
- Do not add Telegram personal-account login unless the user explicitly changes the architecture.
- Do not couple Job Application domain types into Corsair.
- Do not silently add provider tokens to the SDK or browser responses.
- Do not report the platform as complete based only on `encore check`; distinguish implemented, verified, and unclosed gates.
- Preserve the GitHub-linked Encore deployment workflow.
