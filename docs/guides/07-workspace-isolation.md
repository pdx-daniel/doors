# Workspace isolation

## Why workspace isolation

The doors API is designed as a **multi-tenant system**. Every piece of user data belongs to a
_workspace_ — a logical tenant that can be either a `personal` account or an `org` (organization).
Workspace isolation ensures that:

- Data from one workspace is never visible in another.
- All queries are implicitly scoped by a `workspace_id` filter.
- The system can be extended to support per-workspace configuration, billing, and access control
  without changing the data model.

This guide explains how the isolation layer works on the server, how the client sends the required
header, and how to test with multiple workspaces.

---

## How it works

### The header

Every API request (except `GET /health`) **must** include the HTTP header:

```
X-Workspace-Id: 01900000-0000-7000-8000-000000000001
```

The header name is defined as a constant in `packages/api/src/constants.ts`:

```ts
export const WORKSPACE_ID_HEADER = 'x-workspace-id'
```

### Server-side flow

1. The Elysia `workspacePlugin` (see below) reads the header, derives `workspaceId` into the
   request context, and rejects missing or empty values with HTTP 400.
2. Each route group (e.g. `/locations`, `/people`) applies `.use(workspacePlugin)` so every handler
   receives a validated `workspaceId` string.
3. Every database query includes `WHERE workspace_id = ${workspaceId}`.

### Client-side flow

The shared Eden Treaty client in `packages/api/src/client.ts` automatically attaches the
`X-Workspace-Id` header to every outgoing request. In development it uses the seeded
`DEV_WORKSPACE_ID`. Production clients swap the header value at construction time.

---

## Server-side pattern

### Workspace middleware

The header is parsed by `apps/server/src/middleware/workspace.ts`:

```ts
export function readWorkspaceId(headers: Record<string, string | undefined>): string | null {
  const workspaceId = headers[WORKSPACE_ID_HEADER]
  if (typeof workspaceId !== 'string' || !workspaceId) {
    return null
  }
  return workspaceId
}

export function missingWorkspaceResponse(): {error: string} {
  return {error: `Missing ${WORKSPACE_ID_HEADER} header`}
}
```

### Workspace plugin

The high-level Elysia plugin wraps the middleware into a reusable derivation + guard:

`apps/server/src/middleware/workspacePlugin.ts`:

```ts
export const workspacePlugin = new Elysia({name: 'workspace'})
  .derive({as: 'scoped'}, ({headers}) => ({
    workspaceId: readWorkspaceId(headers) ?? '',
  }))
  .onBeforeHandle({as: 'scoped'}, ({workspaceId, set}) => {
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }
  })
```

**How it works step by step:**

1. `.derive({as: 'scoped'}, ...)` injects `workspaceId` into every handler's context. If the header
   is absent, the value is an empty string `''`.
2. `.onBeforeHandle({as: 'scoped'}, ...)` runs **before** every handler. If `workspaceId` is
   falsy (empty string), it short-circuits the request with a 400 response and an error body.
3. The `{as: 'scoped'}` modifier ensures the plugin is local to each route group — it does not leak
   to sibling routes that do not call `.use(workspacePlugin)`.

### Route usage

Every route group calls `.use(workspacePlugin)` immediately after `new Elysia({prefix: ...})`.
The handler then accesses `workspaceId` from context. Example from `locations.ts`:

```ts
export const locationRoutes = new Elysia({prefix: '/locations'})
  .use(workspacePlugin)
  .get('/', async ({workspaceId, query}) => {
    const sql = getSql()
    return await listLocations(sql, workspaceId, bbox)
  })
  .get('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const location = await getLocationById(sql, workspaceId, params.id)
    if (!location) {
      set.status = 404
      return {error: 'Location not found'}
    }
    return location
  })
```

The `peopleRoutes`, `mapRoutes`, and `statsRoutes` follow the same pattern. All four route groups are
mounted under `/v1` in `app.ts`:

```ts
const v1Routes = new Elysia({prefix: '/v1'})
  .use(locationRoutes)
  .use(peopleRoutes)
  .use(mapRoutes)
  .use(statsRoutes)

export const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ok: true, service: 'doors'}))
  .use(v1Routes)
```

`GET /health` does not use `workspacePlugin` and is the only public endpoint.

### Repository (query) layer

Every repository function accepts `workspaceId` as its first parameter and includes it in the SQL
`WHERE` clause. Example from `locationRepo.ts`:

```ts
export async function listLocations(
  sql: SqlClient,
  workspaceId: string,
  bbox?: ParsedBbox,
): Promise<LocationRow[]> {
  const rows = await sql<LocationRow[]>`
    SELECT
      l.id,
      l.workspace_id AS "workspaceId",
      l.name,
      ...
    FROM locations l
    WHERE l.workspace_id = ${workspaceId}
    ...
  `
  return rows
}
```

Write operations also enforce the scoping:

```ts
await sql`
  UPDATE locations
  SET name = ${input.name}, ...
  WHERE id = ${locationId} AND workspace_id = ${workspaceId}
`
```

Cross-workspace references are caught explicitly. The `personRepo` validates that a
`location_id` belongs to the same workspace before creating or updating a person; otherwise it
throws `LocationWorkspaceMismatchError`.

---

## Adding workspace isolation to a new route

To add a new workspace-scoped resource (e.g. `GET /v1/tags`):

1. **Add the database table** with a `workspace_id` column:

   ```sql
   CREATE TABLE tags (
     id UUID PRIMARY KEY,
     workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
     label TEXT NOT NULL
   );

   CREATE INDEX idx_tags_workspace_id ON tags (workspace_id);
   ```

2. **Create a repository function** that accepts `workspaceId` and filters by it:

   ```ts
   export async function listTags(
     sql: SqlClient,
     workspaceId: string,
   ): Promise<TagRow[]> {
     return await sql<TagRow[]>`
       SELECT id, label
       FROM tags
       WHERE workspace_id = ${workspaceId}
       ORDER BY label
     `
   }
   ```

3. **Create a route group** that uses `workspacePlugin`:

   ```ts
   export const tagsRoutes = new Elysia({prefix: '/tags'})
     .use(workspacePlugin)
     .get('/', async ({workspaceId}) => {
       const sql = getSql()
       return await listTags(sql, workspaceId)
     })
   ```

4. **Mount the group** in `app.ts` under `v1Routes`:

   ```ts
   const v1Routes = new Elysia({prefix: '/v1'})
     .use(locationRoutes)
     .use(peopleRoutes)
     .use(mapRoutes)
     .use(statsRoutes)
     .use(tagsRoutes)       // <-- new
   ```

That is all. The plugin handles header validation; the repository function handles data scoping.

---

## Client-side pattern

### Default client

The Eden Treaty client in `packages/api/src/client.ts` sends the workspace header on every request:

```ts
function createApiClient(baseUrl: string = DEFAULT_API_URL): ApiClient {
  return treaty<App>(baseUrl, {
    headers: {
      [WORKSPACE_ID_HEADER]: DEV_WORKSPACE_ID,
    },
  })
}

export const api = createApiClient(resolvedBaseUrl)
```

The module also exports the `DEV_WORKSPACE_ID` constant so consumers can reference it:

```ts
import {DEV_WORKSPACE_ID, WORKSPACE_ID_HEADER} from '@doors/api'
```

### Custom client for a different workspace

To make requests against a non-default workspace, create a fresh client with a different header
value:

```ts
import {treaty} from '@elysiajs/eden'
import type {App} from '@doors/server'
import {WORKSPACE_ID_HEADER, DEFAULT_API_URL} from '@doors/api/constants'

function workspaceClient(workspaceId: string, baseUrl?: string) {
  return treaty<App>(baseUrl ?? DEFAULT_API_URL, {
    headers: {
      [WORKSPACE_ID_HEADER]: workspaceId,
    },
  })
}

const orgClient = workspaceClient('01900000-0000-7000-8000-000000000001')
```

This pattern is used in tests and when the application needs to switch workspaces at runtime (e.g.
after a user signs into a different organization).

---

## Testing with different workspaces

### Strategy

Tests should validate that:

- Requests with a valid workspace header return the correct, scoped data.
- Requests with a **second workspace** return an empty (but successful) result set.
- Requests **without** the header receive HTTP 400.

### Creating a second workspace in tests

Use the `createWorkspace` repository function directly:

```ts
import {createWorkspace} from '@doors/server/db/repos/workspaceRepo'
import {getSql} from '@doors/server/db/client'

const sql = getSql()
const workspaceB = await createWorkspace(sql, {
  kind: 'org',
  name: 'Test Org B',
})
// workspaceB.id is a fresh UUIDv7
```

Then make API calls with `workspaceB.id` as the `X-Workspace-Id` header value. All queries will
return zero rows because no data has been seeded into that workspace.

### Verifying isolation

Create a resource in workspace A, then confirm it is invisible to workspace B:

```ts
// Create a location in workspace A
const loc = await createLocation(sql, {
  workspaceId: workspaceA,
  name: 'Secret Spot',
  geometry: {type: 'Point', coordinates: [0, 0]},
})

// Query workspace B's list — should be empty
const bLocations = await listLocations(sql, workspaceB)
expect(bLocations).toHaveLength(0)

// Direct fetch of the id against workspace B — should be 404
const found = await getLocationById(sql, workspaceB, loc.id)
expect(found).toBeNull()
```

### Testing the header guard

```ts
it('rejects missing workspace header', async () => {
  const res = await app.handle(new Request('http://localhost/v1/locations'))
  expect(res.status).toBe(400)
  const body = await res.json()
  expect(body.error).toMatch(/x-workspace-id/i)
})
```

---

## Database design

### Schema

Every tenant-scoped table includes a `workspace_id` column that is a foreign key to `workspaces`:

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('personal', 'org')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  ...
);

CREATE TABLE people (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  ...
);

CREATE TABLE person_aliases (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  ...
  UNIQUE (workspace_id, source, external_id)
);
```

Note the `ON DELETE CASCADE` — deleting a workspace removes all its child rows. The
`person_aliases` unique constraint is scoped **within** a workspace: the same `(source, external_id)`
can exist in different workspaces without conflict.

### Indexes

Each tenant table has a B-tree index on `workspace_id` for efficient filtering:

```sql
CREATE INDEX IF NOT EXISTS idx_locations_workspace_id ON locations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_people_workspace_id ON people (workspace_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_workspace_id ON person_aliases (workspace_id);
```

### Seed data

The seed script (`apps/server/scripts/seed.ts`) creates one workspace with the fixed
`DEV_WORKSPACE_ID` and all Portland-area venues and people under it. Reseeding clears the dev
workspace first so it is always deterministic.

```
workspaces  ──1:N──>  locations
workspaces  ──1:N──>  people
workspaces  ──1:N──>  person_aliases
```

---

## Import boundaries

Mobile app code **must not** import from `@doors/server` directly. Biome enforces this via a
restricted import rule in `biome.json`:

```json
{
  "includes": ["apps/mobile/**"],
  "linter": {
    "rules": {
      "style": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": {
              "@doors/server": "Use @doors/api instead of importing the server directly"
            }
          }
        }
      }
    }
  }
}
```

The `@doors/api` package re-exports the constants and provides the Eden Treaty client; the server
type `App` is only used internally by `@doors/api` for type inference. If a mobile screen needs
a workspace-aware API client, it should import from `@doors/api`:

```ts
import {api} from '@doors/api'              // default client (dev workspace)
import {WORKSPACE_ID_HEADER} from '@doors/api'  // header constant
```

Conversely, backend packages must not import from `apps/mobile`:

```json
{
  "includes": ["packages/api/**", "apps/server/**"],
  "linter": {
    "rules": {
      "style": {
        "noRestrictedImports": {
          "options": {
            "patterns": [{
              "group": ["**/apps/mobile/**"],
              "message": "Backend packages must not import from apps/mobile"
            }]
          }
        }
      }
    }
  }
}
```

---

## Best practices

**Always scope queries by `workspace_id`.** Every `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on a
tenant table must include a `WHERE workspace_id = ${workspaceId}` clause. Omitting this is a data
leak vulnerability.

**Never bypass the header check.** Do not hard-code a fallback workspace ID in route handlers. The
`workspacePlugin` guard is the single gate; if a route needs to be public (like `/health`), it
should not use the plugin at all.

**Use UUIDv7 for all IDs.** The `newId()` helper in `apps/server/src/lib/id.ts` generates
time-sortable UUIDv7 strings. This applies to workspace IDs, person IDs, and location IDs. Fixed
workspace IDs (like `DEV_WORKSPACE_ID`) are an exception for development convenience and should
never appear in production code.

**Validate cross-resource workspace ownership.** When a resource references another resource by ID
(e.g. `people.location_id`), verify that the referenced resource exists in the same workspace.
The `personRepo` throws `LocationWorkspaceMismatchError` when a location belongs to a different
workspace; catch this in the route handler and return HTTP 400.

**Use the Eden client for type safety.** Avoid raw `fetch` calls. The Treaty client ensures the
header is sent and the request/response types match the Elysia route definitions.

**Test with at least two workspaces.** A test that only creates and reads in one workspace cannot
detect missing `workspace_id` filters. Always create a second workspace and assert isolation.

**Keep the health endpoint public.** The only endpoint that should not require `X-Workspace-Id` is
`GET /health`. Load balancers and orchestration probes must be able to reach it without a tenant
context.
