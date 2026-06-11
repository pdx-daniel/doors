-- Enable PostGIS for geometry columns and spatial queries.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('personal', 'org')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  location_type TEXT NOT NULL DEFAULT 'point',
  geom geometry(Geometry, 4326) NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' || coalesce(address, '')
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  location_id UUID REFERENCES locations (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(display_name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(metadata ->> 'occupation', '') || ' ' ||
      coalesce(metadata ->> 'gender', '')
    )
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS person_aliases (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_locations_workspace_id ON locations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_locations_search_vector ON locations USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_people_workspace_id ON people (workspace_id);
CREATE INDEX IF NOT EXISTS idx_people_location_id ON people (location_id);
CREATE INDEX IF NOT EXISTS idx_people_metadata ON people USING GIN (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_people_search_vector ON people USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_person_aliases_person_id ON person_aliases (person_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_workspace_id ON person_aliases (workspace_id);
