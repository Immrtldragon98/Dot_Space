import { db } from './pool.js';

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  human_status TEXT NOT NULL DEFAULT 'AVAILABLE',
  custom_status TEXT,
  status_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_human_status_check;
ALTER TABLE users ADD CONSTRAINT users_human_status_check
  CHECK (human_status IN ('AVAILABLE','QUIET','BUSY','SLEEPING','TRAVELLING','CUSTOM'));
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status_expiry ON users(status_expires_at) WHERE status_expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_low_id UUID GENERATED ALWAYS AS (LEAST(requester_id, addressee_id)) STORED,
  user_high_id UUID GENERATED ALWAYS AS (GREATEST(requester_id, addressee_id)) STORED,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACCEPTED','REJECTED','BLOCKED')),
  acted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (user_low_id, user_high_id)
);
CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON connections(addressee_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

CREATE TABLE IF NOT EXISTS privacy_permissions (
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_presence BOOLEAN NOT NULL DEFAULT TRUE,
  share_status BOOLEAN NOT NULL DEFAULT FALSE,
  share_last_seen BOOLEAN NOT NULL DEFAULT FALSE,
  allow_signals BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, viewer_id),
  CHECK (owner_id <> viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_privacy_viewer ON privacy_permissions(viewer_id);

CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  device_name TEXT,
  platform TEXT,
  push_token TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON device_sessions(user_id, revoked_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_push_token ON device_sessions(push_token) WHERE push_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('THINKING_OF_YOU','AROUND','WAVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_signals_recipient_created ON signals(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_sender_created ON signals(sender_id, created_at DESC);
`;

try {
  await db.query(sql);
  console.log('Dot Space database migration complete.');
} finally {
  await db.end();
}
