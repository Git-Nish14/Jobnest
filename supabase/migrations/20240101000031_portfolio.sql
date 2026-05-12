-- Migration 31: Portfolio & Developer Identity — public portfolio, GitHub OAuth, projects
-- Depends on: 00 (job_applications), 24 (developer_identity: skills/certs/education)
--
-- New tables:
--   usernames           — unique vanity slug per user, powers /p/{username} routing
--   github_connections  — OAuth token + cached GitHub profile stats
--   github_repos        — cached repositories with pin flag for portfolio display
--   projects            — user-curated project showcase (manual or linked to a repo)
--   application_projects — many-to-many: job_applications ↔ projects

-- ── 1. Unique usernames ───────────────────────────────────────────────────────
-- One row per user. The username is the public URL slug (/p/<username>).
-- Claim/release is done exclusively via the service role in API routes so that
-- uniqueness is atomically enforced without exposing the table to the client.

CREATE TABLE IF NOT EXISTS usernames (
  username   TEXT        PRIMARY KEY
               CHECK (username ~ '^[a-z0-9][a-z0-9\-]{1,28}[a-z0-9]$'),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_username_user UNIQUE (user_id)
);

ALTER TABLE usernames ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: all reads/writes go through the service role
CREATE POLICY "usernames_deny_all"
  ON usernames
  USING (false);

COMMENT ON TABLE usernames IS
  'One-row-per-user vanity slugs for public portfolio URLs (/p/<username>). '
  'Mutations are service-role only to guarantee atomic uniqueness.';

-- ── 2. GitHub OAuth connections ──────────────────────────────────────────────
-- Stores the OAuth access token and a cached snapshot of the GitHub profile.
-- Inserts and updates are performed by the service role (OAuth callback / cron).
-- Users can read and delete their own row via the anon key.

CREATE TABLE IF NOT EXISTS github_connections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id           BIGINT      NOT NULL,
  github_username     TEXT        NOT NULL,
  github_name         TEXT,
  github_avatar_url   TEXT,
  github_bio          TEXT,
  github_location     TEXT,
  github_company      TEXT,
  github_blog         TEXT,
  github_public_repos INT         NOT NULL DEFAULT 0,
  github_followers    INT         NOT NULL DEFAULT 0,
  github_following    INT         NOT NULL DEFAULT 0,
  access_token        TEXT        NOT NULL,
  scopes              TEXT[]      NOT NULL DEFAULT ARRAY['read:user','public_repo'],
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY "github_connections_select_own"
  ON github_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "github_connections_delete_own"
  ON github_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE TRIGGER github_connections_updated_at
  BEFORE UPDATE ON github_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE github_connections IS
  'GitHub OAuth connection per user. Stores the access token (read:user + public_repo scope) '
  'and a cached profile snapshot refreshed by the daily github-sync cron job.';
COMMENT ON COLUMN github_connections.access_token IS
  'GitHub OAuth access token. Protected by RLS (no client SELECT) and only '
  'accessed server-side via the service role.';

-- ── 3. GitHub repos (cached) ─────────────────────────────────────────────────
-- Up to ~100 most-recently-pushed repos per user, synced from the GitHub API.
-- is_pinned = true means the repo appears in the public portfolio (max 6).

CREATE TABLE IF NOT EXISTS github_repos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_repo_id   BIGINT      NOT NULL,
  name             TEXT        NOT NULL,
  full_name        TEXT        NOT NULL,
  description      TEXT,
  html_url         TEXT        NOT NULL,
  homepage_url     TEXT,
  language         TEXT,
  stargazers_count INT         NOT NULL DEFAULT 0,
  forks_count      INT         NOT NULL DEFAULT 0,
  is_fork          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_archived      BOOLEAN     NOT NULL DEFAULT FALSE,
  topics           TEXT[]      NOT NULL DEFAULT '{}',
  is_pinned        BOOLEAN     NOT NULL DEFAULT FALSE,
  pushed_at        TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_github_repo UNIQUE (user_id, github_repo_id)
);

ALTER TABLE github_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_repos FORCE ROW LEVEL SECURITY;

CREATE POLICY "github_repos_owner"
  ON github_repos
  FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_github_repos_user   ON github_repos (user_id);
CREATE INDEX IF NOT EXISTS idx_github_repos_pinned ON github_repos (user_id, is_pinned);

COMMENT ON TABLE github_repos IS
  'Cached GitHub repository list per user. Refreshed on OAuth connect, '
  'manual sync, and the daily github-sync cron. is_pinned repos are shown '
  'on the public portfolio (max 6, mirroring GitHub''s own UI limit).';

-- ── 4. Projects ──────────────────────────────────────────────────────────────
-- User-curated project entries. Can be created manually or linked to a cached
-- GitHub repo. display_order controls the portfolio sort sequence.

CREATE TABLE IF NOT EXISTS projects (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description    TEXT        CHECK (char_length(description) <= 1000),
  tags           TEXT[]      NOT NULL DEFAULT '{}',
  demo_url       TEXT        CHECK (demo_url IS NULL OR demo_url ~* '^https?://'),
  repo_url       TEXT        CHECK (repo_url IS NULL OR repo_url ~* '^https?://'),
  image_url      TEXT,
  github_repo_id UUID        REFERENCES github_repos(id) ON DELETE SET NULL,
  is_featured    BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order  INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY "projects_owner"
  ON projects
  FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_projects_user  ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_order ON projects (user_id, display_order);

COMMENT ON TABLE projects IS
  'User-curated project showcase for the public portfolio. Optionally linked '
  'to a cached GitHub repo for live star/fork counts. display_order is managed '
  'client-side via up/down controls (1-indexed swaps).';

-- ── 5. Applications ↔ Projects junction ─────────────────────────────────────
-- Links a job application to one or more portfolio projects, so recruiters
-- and the user can see which projects were highlighted for a specific role.

CREATE TABLE IF NOT EXISTS application_projects (
  application_id UUID        NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  project_id     UUID        NOT NULL REFERENCES projects(id)          ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (application_id, project_id)
);

ALTER TABLE application_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_projects FORCE ROW LEVEL SECURITY;

CREATE POLICY "application_projects_owner"
  ON application_projects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.id = application_id
        AND ja.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.id = application_id
        AND ja.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_app_projects_app  ON application_projects (application_id);
CREATE INDEX IF NOT EXISTS idx_app_projects_proj ON application_projects (project_id);

COMMENT ON TABLE application_projects IS
  'Many-to-many join between job_applications and projects. Lets users tag '
  'which portfolio projects they highlighted when applying for a specific role.';
