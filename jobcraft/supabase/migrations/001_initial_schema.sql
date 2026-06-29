-- JobCraft initial schema

CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL UNIQUE,
  name            TEXT,
  email           TEXT,
  phone           TEXT,
  location        TEXT,
  linkedin_url    TEXT,
  website_url     TEXT,
  summary         TEXT,
  work_experience JSONB DEFAULT '[]',
  education       JSONB DEFAULT '[]',
  skills          TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  gmail_message_id  TEXT NOT NULL,
  title             TEXT NOT NULL,
  company           TEXT NOT NULL,
  location          TEXT,
  job_url           TEXT,
  email_date        TIMESTAMPTZ,
  raw_description   TEXT,
  status            TEXT DEFAULT 'new',
  user_tag          TEXT DEFAULT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_message_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cover_letter    TEXT,
  tailored_resume JSONB,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  last_edited_at  TIMESTAMPTZ,
  UNIQUE(job_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  doc_type    TEXT NOT NULL DEFAULT 'other',
  file_url    TEXT NOT NULL,
  file_size   INT,
  mime_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);
CREATE INDEX IF NOT EXISTS applications_job_id_idx ON applications(job_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
