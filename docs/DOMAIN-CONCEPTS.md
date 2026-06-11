# Domain Concepts

The doors monorepo has four canonical entities. This doc explains what each one is, its SQL shape, its TypeScript type, the API routes that touch it, and how to find all the details in one place.

---

## Workspace

A **workspace** is the multi-tenant isolation boundary. Every piece of data belongs to exactly one workspace. All API requests carry an `X-Workspace-Id` header, and the server rejects requests that omit it.

### SQL

```sql
-- apps/server/migrations/001_init.sql
CREATE TABLE workspaces (
  id       UUID PRIMARY KEY,
  kind     TEXT NOT NULL CHECK (kind IN ('personal', 'org')),
  name     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### TypeScript

```ts
// apps/server/src/db/repos/workspaceRepo.ts
type WorkspaceKind = 'personal' | 'org'

type WorkspaceRow = {
  id: string
  kind: WorkspaceKind
  name: string
  createdAt: string
}
```

No `WorkspaceResource` is exported to `@doors/api/schemas` — workspaces are internal infrastructure, not exposed via CRUD routes.

### API routes

None directly (no `/v1/workspaces` endpoint today). The dev seed creates one workspace:

```
bun run db:seed  →  Workspace { id: '01900000-0000-7000-8000-000000000001', kind: 'org', name: 'Doors Dev' }
```

This id is exported as `DEV_WORKSPACE_ID` from `@doors/api/constants` and is the default sent by the Eden Treaty client.

### How to find everything about Workspace

| What | Where |
|------|-------|
| SQL DDL | `apps/server/migrations/001_init.sql` — `CREATE TABLE workspaces` |
| TypeScript type | `apps/server/src/db/repos/workspaceRepo.ts` — `WorkspaceRow`, `WorkspaceKind`, `CreateWorkspaceInput` |
| Repository | `apps/server/src/db/repos/workspaceRepo.ts` — `createWorkspace()` |
| Header plumbing | `apps/server/src/middleware/workspace.ts` — `readWorkspaceId()`, `missingWorkspaceResponse()` |
| Elysia plugin | `apps/server/src/middleware/workspacePlugin.ts` — derives `workspaceId`, guards on missing |
| Client constant | `packages/api/src/constants.ts` — `DEV_WORKSPACE_ID`, `WORKSPACE_ID_HEADER` |
| Seed usage | `apps/server/scripts/seed.ts` — `createWorkspace(sql, { id: DEV_WORKSPACE_ID, kind: 'org', name: 'Doors Dev' })` |

---

## Location

A **location** is a geographic place with a name, address, type, and PostGIS geometry. Locations are workspace-scoped and serve as anchors for people.

### SQL

```sql
-- apps/server/migrations/001_init.sql
CREATE TABLE locations (
  id            UUID PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT NOT NULL DEFAULT '',
  location_type TEXT NOT NULL DEFAULT 'point',
  geom          geometry(Geometry, 4326) NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(address, ''))
  ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### TypeScript

```ts
// packages/api/src/schemas.ts
type LocationResource = {
  id: string
  workspaceId: string
  name: string
  address: string
  locationType: string
  geometry: GeoJsonGeometry          // { type: string, coordinates: unknown }
  createdAt: string
  updatedAt: string
}
```

The repository uses `LocationRow = LocationResource` and defines input types:

```ts
// apps/server/src/db/repos/locationRepo.ts
type CreateLocationInput = {
  id?: string
  workspaceId: string
  name: string
  address?: string
  locationType?: string
  geometry: GeoJsonGeometry
}

type UpdateLocationInput = {
  name?: string
  address?: string
  locationType?: string
  geometry?: GeoJsonGeometry
}
```

### API routes

All under `/v1/locations`, workspace-scoped via `workspacePlugin`:

| Method | Path | Body/Query | Description |
|--------|------|------------|-------------|
| `GET` | `/v1/locations` | `?bbox=w,s,e,n` | List locations in workspace (optionally filtered by bounding box) |
| `GET` | `/v1/locations/:id` | — | Get single location (404 if missing in workspace) |
| `POST` | `/v1/locations` | `{ name, address?, locationType?, geometry }` | Create location |
| `PATCH` | `/v1/locations/:id` | partial fields | Update location |
| `DELETE` | `/v1/locations/:id` | — | Delete location |

Route definition: `apps/server/src/routes/locations.ts`.

### How to find everything about Location

| What | Where |
|------|-------|
| SQL DDL | `apps/server/migrations/001_init.sql` — `CREATE TABLE locations` |
| API response type | `packages/api/src/schemas.ts` — `LocationResource`, `GeoJsonGeometry` |
| Repository input types | `apps/server/src/db/repos/locationRepo.ts` — `CreateLocationInput`, `UpdateLocationInput` |
| Repository functions | `apps/server/src/db/repos/locationRepo.ts` — CRUD |
| Route schemas | `apps/server/src/routes/locations.ts` — Elysia `t.Object` validators |
| API route file | `apps/server/src/routes/locations.ts` |
| Seed usage | `apps/server/scripts/seed.ts` — 20 Portland venues + ~20 micro-locations |

---

## Person

A **person** is a record of an individual — their name, contact info, optional location link, and free-form metadata (JSONB). People are workspace-scoped. There is currently **no concept of a user account** (auth, login, etc.) — the system tracks "persons of interest" (clients, constituents, residents, etc.).

### SQL

```sql
-- apps/server/migrations/001_init.sql
CREATE TABLE people (
  id            UUID PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  location_id   UUID REFERENCES locations (id) ON DELETE SET NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(display_name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(metadata ->> 'occupation', '') || ' ' ||
      coalesce(metadata ->> 'gender', '')
    )
  ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### TypeScript

```ts
// packages/api/src/schemas.ts
type PersonResource = {
  id: string
  workspaceId: string
  displayName: string
  email: string
  phone: string
  locationId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

Repository input types:

```ts
// apps/server/src/db/repos/personRepo.ts
type CreatePersonInput = {
  id?: string
  workspaceId: string
  displayName: string
  email?: string
  phone?: string
  locationId?: string | null
  metadata?: Record<string, unknown>
}

type UpdatePersonInput = {
  displayName?: string
  email?: string
  phone?: string
  locationId?: string | null
  metadata?: Record<string, unknown>
}
```

A `LocationWorkspaceMismatchError` is thrown when creating/updating a person's location reference if the location belongs to a different workspace.

### API routes

All under `/v1/people`, workspace-scoped:

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/v1/people` | — | List all people in workspace (ordered by display name) |
| `GET` | `/v1/people/:id` | — | Get single person (404 if missing) |
| `POST` | `/v1/people` | `{ displayName, email?, phone?, locationId?, metadata? }` | Create person |
| `PATCH` | `/v1/people/:id` | partial fields | Update person |
| `DELETE` | `/v1/people/:id` | — | Delete person |

**Map query** — people are also returned as GeoJSON via the map API:

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| `GET` | `/v1/map/people` | `bbox, zoom, cluster, q, filter, ...` | GeoJSON FeatureCollection of people (clustered or individual) |
| `GET` | `/v1/stats/histogram` | `field, bbox, q, filter, ...` | Histogram over a metadata field |

Route definitions: `apps/server/src/routes/people.ts`, `apps/server/src/routes/map.ts`, `apps/server/src/routes/stats.ts`.

### How to find everything about Person

| What | Where |
|------|-------|
| SQL DDL | `apps/server/migrations/001_init.sql` — `CREATE TABLE people` |
| API response type | `packages/api/src/schemas.ts` — `PersonResource` |
| Repository input types | `apps/server/src/db/repos/personRepo.ts` — `CreatePersonInput`, `UpdatePersonInput` |
| Repository functions | `apps/server/src/db/repos/personRepo.ts` — CRUD + `createPersonAlias` |
| Domain error | `apps/server/src/db/repos/personRepo.ts` — `LocationWorkspaceMismatchError` |
| Route schemas | `apps/server/src/routes/people.ts` — Elysia `t.Object` validators |
| Map route | `apps/server/src/routes/map.ts` — GeoJSON people layer |
| Stats route | `apps/server/src/routes/stats.ts` — metadata histograms |
| GeoJSON feature types | `packages/api/src/schemas.ts` — `MapPersonProperties`, `MapClusterProperties`, `GeoJsonFeatureCollection` |
| Map filter types | `apps/server/src/db/geo/mapFilters.ts` — `MapPeopleFilters`, `MapBucketRow`, `ClusterRow` |
| Seed usage | `apps/server/scripts/seed.ts` — ~70 people across 20 Portland venues |

---

## Person Alias

A **person alias** bridges a person record to an external identity from another system (e.g., a CRM id, a legacy database key). The combination `(workspace_id, source, external_id)` is unique.

### SQL

```sql
-- apps/server/migrations/001_init.sql
CREATE TABLE person_aliases (
  id            UUID PRIMARY KEY,
  workspace_id  UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  person_id     UUID NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  source        TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source, external_id)
);
```

### TypeScript

There is no dedicated exported type — the alias is used inline in the repository:

```ts
// apps/server/src/db/repos/personRepo.ts
input: {
  id?: string
  workspaceId: string
  personId: string
  source: string
  externalId: string
}
```

### API routes

None yet — `createPersonAlias` exists in the repository but has no route. It is only called from the seed script.

### How to find everything about Person Alias

| What | Where |
|------|-------|
| SQL DDL | `apps/server/migrations/001_init.sql` — `CREATE TABLE person_aliases` |
| Repository function | `apps/server/src/db/repos/personRepo.ts` — `createPersonAlias()` |
| Seed usage | `apps/server/scripts/seed.ts` — attached to the first 5 seeded people with source `'dev-seed'` |

---

## Entity Relationships

```
Workspace (1) ──→ Location (many)
Workspace (1) ──→ Person (many)
Workspace (1) ──→ PersonAlias (many)
  Person (1) ──→ Location (optional, many-to-one)
  Person (1) ──→ PersonAlias (many)

Location has: workspace_id FK → Workspace
Person has:   workspace_id FK → Workspace
              location_id  FK → Location  (SET NULL on delete)
PersonAlias has: workspace_id FK → Workspace
                 person_id    FK → Person    (CASCADE on delete)
                 UNIQUE(workspace_id, source, external_id)
```

---

## Notable Absences

- **User** — There is no `users` table, no auth, no login. The system tracks *persons of interest*, not application users. If authentication is added later, it will be a new concept separate from `people`.
- **Groups / Tags / Categories** — People have free-form `metadata` (JSONB) for ad-hoc attributes like occupation and gender, but there is no formal group or tag entity.
- **Events / Activity** — There is no event log, audit trail, or activity feed.

---

## How to Discover This Yourself

If you need to trace a concept end-to-end, follow this pattern:

1. **SQL schema** → `apps/server/migrations/001_init.sql` (the single source of truth for all tables)
2. **API response type** → `packages/api/src/schemas.ts` (types shared between server and mobile via `@doors/api/schemas`)
3. **Repository input types** → `apps/server/src/db/repos/<entity>Repo.ts` (database access layer)
4. **Route file** → `apps/server/src/routes/<entity>.ts` (Elysia handlers + validation schemas)
5. **Client usage** → `apps/mobile/src/hooks/` or `apps/mobile/src/lib/` (how the mobile app consumes the API)

For map-specific queries, the flow is:
`apps/server/src/routes/map.ts` → `apps/server/src/lib/queryParams.ts` (`MapQueryParams`) → `apps/server/src/db/geo/mapFilters.ts` (`MapPeopleFilters`) → `apps/server/src/db/repos/mapQueryRepo.ts` → `GeoJsonFeatureCollection`
