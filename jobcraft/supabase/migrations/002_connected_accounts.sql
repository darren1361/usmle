-- Connected accounts for multi-Gmail sync
CREATE TABLE IF NOT EXISTS connected_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  email         TEXT NOT NULL,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS connected_accounts_user_id_idx ON connected_accounts(user_id);

-- Add source column to jobs table to track where each job came from
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'linkedin';
