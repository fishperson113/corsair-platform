CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  account_email TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  credential_ciphertext TEXT NOT NULL,
  credential_iv TEXT NOT NULL,
  credential_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_email TEXT,
  connection_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX connections_provider_idx ON connections(provider);
CREATE INDEX audit_events_created_at_idx ON audit_events(created_at DESC);
