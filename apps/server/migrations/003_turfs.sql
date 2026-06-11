-- Turf metadata linked 1:1 to polygon locations.
CREATE TABLE IF NOT EXISTS turfs (
  id           UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  location_id  UUID NOT NULL UNIQUE REFERENCES locations (id) ON DELETE CASCADE,
  color        TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turfs_workspace_id ON turfs (workspace_id);
