# API Routes

This guide covers everything you need to add a new API endpoint to the doors monorepo. The API server uses **Elysia 1.4.x** on **Bun**, with request validation via **Elysia/TypeBox**, database access through **postgres.js** with a repository pattern, and type-safe client generation via **Eden Treaty**.

---

## 1. Route structure overview

All API routes live under the `/v1/*` prefix and are **workspace-scoped** via a shared plugin.

| Prefix | Mounted routes        | File                                        |
|--------|-----------------------|---------------------------------------------|
| `/v1/locations` | CRUD for locations    | `apps/server/src/routes/locations.ts`       |
| `/v1/people`    | CRUD for people      | `apps/server/src/routes/people.ts`          |
| `/v1/map`       | Map queries/clusters | `apps/server/src/routes/map.ts`             |
| `/v1/stats`     | Aggregated stats     | `apps/server/src/routes/stats.ts`           |
| `/health`       | Health check (no v1) | `apps/server/src/app.ts` (inline)           |

The app is assembled in `apps/server/src/app.ts`:

```ts
// apps/server/src/app.ts
import {Elysia} from 'elysia'
import {cors} from '@elysiajs/cors'
import {locationRoutes} from './routes/locations'
import {mapRoutes} from './routes/map'
import {peopleRoutes} from './routes/people'
import {statsRoutes} from './routes/stats'

const v1Routes = new Elysia({prefix: '/v1'})
  .use(locationRoutes)
  .use(peopleRoutes)
  .use(mapRoutes)
  .use(statsRoutes)

export const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ok: true as const, service: 'doors'}))
  .use(v1Routes)

export type App = typeof app
```

The exported `App` type is what Eden Treaty reads to generate the fully-typed client.

---

## 2. Adding a new route group

### a. Create the route file

Every route group goes in its own file inside `apps/server/src/routes/`. Name it after the resource (plural noun):

```
apps/server/src/routes/<resource>.ts
```

### b. Start with the boilerplate

```ts
// apps/server/src/routes/events.ts
import {Elysia, t} from 'elysia'

import {getSql} from '../db/client'
import {
  createEvent,
  deleteEvent,
  getEventById,
  listEvents,
  updateEvent,
} from '../db/repos/eventRepo'
import {workspacePlugin} from '../middleware/workspacePlugin'
```

### c. Use the workspace plugin

The `workspacePlugin` derives a `workspaceId` string from the `x-workspace-id` header and rejects requests that omit it with a `400` error. Every data route *must* scope queries with this id.

```ts
export const eventRoutes = new Elysia({prefix: '/events'})
  .use(workspacePlugin)
```

After `.use(workspacePlugin)`, all downstream handlers receive `workspaceId` in their context.

### d. Define routes

Each route follows the same shape:

```ts
  .get(
    '/',
    async ({workspaceId, query}) => {
      const sql = getSql()
      return await listEvents(sql, workspaceId, query)
    },
    {
      query: t.Object({
        category: t.Optional(t.String()),
      }),
    },
  )
  .get('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const event = await getEventById(sql, workspaceId, params.id)

    if (!event) {
      set.status = 404
      return {error: 'Event not found'}
    }

    return event
  })
  .post(
    '/',
    async ({workspaceId, body}) => {
      const sql = getSql()
      return await createEvent(sql, {
        workspaceId,
        name: body.name,
        description: body.description,
        startDate: body.startDate,
      })
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        startDate: t.String(),
      }),
    },
  )
  .patch(
    '/:id',
    async ({workspaceId, params, body, set}) => {
      const sql = getSql()
      const event = await updateEvent(sql, workspaceId, params.id, body)

      if (!event) {
        set.status = 404
        return {error: 'Event not found'}
      }

      return event
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
      }),
    },
  )
  .delete('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const deleted = await deleteEvent(sql, workspaceId, params.id)

    if (!deleted) {
      set.status = 404
      return {error: 'Event not found'}
    }

    return {ok: true as const}
  })
```

### e. Export the route group

```ts
export const eventRoutes = new Elysia({prefix: '/events'})
  // ... all route definitions
```

---

## 3. Request validation

Elysia uses **TypeBox** (imported as `t` from `elysia`) to define schemas for query strings, path params, and request bodies. Schemas are passed as the third argument to `.get()`, `.post()`, `.patch()`, etc.

### Query params

```ts
.get('/', handler, {
  query: t.Object({
    bbox: t.Optional(t.String()),
    zoom: t.Optional(t.Number()),
    q: t.Optional(t.String()),
  }),
})
```

- `t.Optional(...)` makes the field optional in the type system.
- Elysia coerses `t.Number()` query params from strings automatically.
- All query param values arrive as strings in the raw HTTP request; Elysia parses `t.Number()` into actual numbers.

### Path params

```ts
.get('/:id', ({params}) => {
  // params.id is typed as string
})
```

Path params have implicit `t.String()` types by default.

### Body

```ts
.post('/', handler, {
  body: t.Object({
    name: t.String(),
    email: t.Optional(t.String()),
    locationId: t.Optional(t.Union([t.String(), t.Null()])),
    metadata: t.Optional(t.Record(t.String(), t.Unknown())),
    geometry: t.Object({
      type: t.String(),
      coordinates: t.Unknown(),
    }),
  }),
})
```

### Reusable shared schemas

Do not define body or query schemas inline in route files when they represent domain concepts. Put them in `packages/api/src/validators/` and import them:

```ts
// apps/server/src/routes/locations.ts
import {
  createLocationBodySchema,
  listLocationsQuerySchema,
  updateLocationBodySchema,
} from '@doors/api/validators/location'

.post('/', handler, {body: createLocationBodySchema})
```

Geo helpers (e.g. `geometrySchema`) live in `@doors/api/geo/geoJson` or are re-exported from the entity's validator module. See [Adding shared domain types](#8-adding-shared-domain-types) below.

### Common type patterns

```ts
t.String()                    // string
t.Number()                    // number
t.Boolean()                   // boolean
t.Optional(t.String())        // string | undefined
t.Union([t.String(), t.Null()]) // string | null
t.Record(t.String(), t.Unknown()) // Record<string, unknown>
t.Unknown()                   // unknown (for unstructured data)
```

If validation fails, Elysia returns a `422` response with the validation error details automatically.

---

## 4. Returning errors

Do not throw strings or bare objects. The pattern in the codebase is:

### 4xx errors

```ts
set.status = 404
return {error: 'Location not found'}
```

```ts
set.status = 400
return {error: 'Invalid bounding box format'}
```

- Set `set.status` to the desired HTTP status code.
- Return an object with a single `error` string property.
- The handler `return` stops execution — you do not need `return` after `set.status` in a separate statement; the `return` in the pattern above does both.

### 5xx errors

Let unexpected errors propagate. Elysia catches them and returns a `500` response. Do not catch-and-rethrow for generic failures unless you need to add context or convert known domain errors:

```ts
try {
  return await createPerson(sql, { /* ... */ })
} catch (error) {
  if (error instanceof LocationWorkspaceMismatchError) {
    set.status = 400
    return {error: error.message}
  }
  throw error  // unknown errors become 500
}
```

---

## 5. Registering the route

After creating your route file, register it in `apps/server/src/app.ts`:

```ts
// apps/server/src/app.ts
import {eventRoutes} from './routes/events'    // add

const v1Routes = new Elysia({prefix: '/v1'})
  .use(locationRoutes)
  .use(peopleRoutes)
  .use(mapRoutes)
  .use(statsRoutes)
  .use(eventRoutes)                             // add
```

Order matters: routes are evaluated in declaration order.

---

## 6. Eden Treaty auto-types

The `App` type exported from `apps/server/src/app.ts` is the **single source of truth** for the typed client. Eden Treaty reads this type and provides full autocompletion and type checking.

When you add a new route to the server, the client types **update automatically** — no code generation step, no manual sync.

If you see a type error on the client side after adding a route, run `bun run typecheck` from the root. The most common cause is a TypeScript project reference cache issue; restarting the TS language server usually fixes it.

---

## 7. Using the API from the client

The Eden Treaty client is in `packages/api/src/client.ts` and exported as `@doors/api`:

```ts
import {api, DEV_WORKSPACE_ID} from '@doors/api'

// Health check (no auth/workspace required)
const health = await api.health.get()
// health.data => {ok: true, service: 'doors'}
// health.error => EdenTreatyError | null

// List locations in the dev workspace
const locations = await api.v1.locations.get({
  query: {bbox: '-122.7,45.4,-122.4,45.7'},
})

// Get a single location
const location = await api.v1.locations({id: 'some-uuid'}).get()

// Create a location
const created = await api.v1.locations.post({
  body: {
    name: 'HQ',
    geometry: {type: 'Point', coordinates: [-122.68, 45.52]},
  },
})

// Delete
const result = await api.v1.locations({id: 'some-uuid'}).delete()
```

The client automatically sends the `x-workspace-id` header (set to `DEV_WORKSPACE_ID`) on every request via the default configuration.

### Accessing namespaced exports

The package exposes several entry points:

```ts
import {api, DEV_WORKSPACE_ID, WORKSPACE_ID_HEADER} from '@doors/api'
import {WORKSPACE_ID_HEADER} from '@doors/api/constants'
import type {GeoJsonFeatureCollection, MapViewport} from '@doors/api/geo/mapPeople'
import type {LocationResource} from '@doors/api/entities/location'
```

These are configured in `packages/api/package.json`:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./constants": "./src/constants.ts",
    "./entities/location": "./src/entities/location.ts",
    "./entities/person": "./src/entities/person.ts",
    "./validators/location": "./src/validators/location.ts",
    "./geo/mapPeople": "./src/geo/mapPeople.ts"
  }
}
```

Import subpaths directly (`@doors/api/entities/person`, `@doors/api/validators/person`, etc.). The root `@doors/api` barrel re-exports only the most common client types.

---

## 8. Adding shared domain types

Canonical entity shapes live in `@doors/api`. TypeBox/Elysia schemas are the **single source of truth**; TypeScript types are derived with `Static<typeof schema>` from `elysia`.

Layout (see also [`docs/DOMAIN-CONCEPTS.md`](../DOMAIN-CONCEPTS.md)):

```
packages/api/src/
├── entities/       # Resource rows + repo input types (workspace, location, person, personLink)
├── validators/     # Route body/query schemas imported by apps/server/src/routes/
├── geo/            # Bbox, GeoJSON, map feature types
└── stats/          # Histogram response shapes
```

### Step 1: Add entity resource schema

`packages/api/src/entities/event.ts`

```ts
import {t, type Static} from 'elysia'

/** Event resource returned by CRUD endpoints. */
export const eventResourceSchema = t.Object({
  id: t.String(),
  workspaceId: t.String(),
  name: t.String(),
  description: t.String(),
  startDate: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
})

export type EventResource = Static<typeof eventResourceSchema>
export type EventRow = EventResource
```

### Step 2: Add route validators

`packages/api/src/validators/event.ts`

```ts
import {t, type Static} from 'elysia'

export const createEventBodySchema = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
  startDate: t.String(),
})

export type CreateEventBody = Static<typeof createEventBodySchema>

export const updateEventBodySchema = t.Object({
  name: t.Optional(t.String()),
  description: t.Optional(t.String()),
  startDate: t.Optional(t.String()),
})
```

Compose repo inputs in the entity module:

```ts
// packages/api/src/entities/event.ts
import type {CreateEventBody} from '../validators/event'

export type CreateEventInput = {id?: string; workspaceId: string} & CreateEventBody
export type UpdateEventInput = Static<typeof updateEventBodySchema>
```

### Step 3: Wire server routes and repos

```ts
// apps/server/src/routes/events.ts
import {createEventBodySchema} from '@doors/api/validators/event'

.post('/', handler, {body: createEventBodySchema})
```

```ts
// apps/server/src/db/repos/eventRepo.ts
import type {CreateEventInput, EventRow} from '@doors/api/entities/event'
```

### Step 4: Export subpath + optional barrel re-export

Add the new files to `packages/api/package.json` `exports`. Re-export types the mobile client needs from `packages/api/src/index.ts` (the only allowed barrel file).

### Server-only entities

Some entities have no HTTP routes yet but still belong in `entities/` for a single typed home — e.g. **`personLink`** maps a `Person` to an external id (`source` + `externalId`, unique per workspace). The seed script calls `createPersonLink()`; there is no `/v1/person-links` route today.

---

## 9. Best practices

### Workspace scoping on all queries

Every database query must filter by `workspaceId`. The `workspacePlugin` guarantees the header is present at the handler level, but it is your responsibility to pass it to repo functions. Never write a query that can read data from another workspace.

### Typed validation is required

Every public route must define explicit `query`, `body`, or `params` schemas using Elysia's `t` validators. This provides:

- Automatic request validation (returns `422` on malformed input)
- Correct TypeScript types inside the handler context
- Accurate Eden Treaty client types for consumers

### Repository pattern for database access

Keep SQL out of route handlers. Database logic lives in `apps/server/src/db/repos/` files:

```
apps/server/src/db/repos/locationRepo.ts
apps/server/src/db/repos/personRepo.ts
apps/server/src/db/repos/mapQueryRepo.ts
apps/server/src/db/repos/eventRepo.ts   // new
```

Each repo function receives the `SqlClient` as its first argument (obtained via `getSql()`):

```ts
// apps/server/src/db/repos/eventRepo.ts
import type {SqlClient} from '../client'

export async function listEvents(
  sql: SqlClient,
  workspaceId: string,
  options?: {category?: string},
): Promise<EventResource[]> {
  return sql<EventResource[]>`
    SELECT * FROM events
    WHERE workspace_id = ${workspaceId}
    ${options?.category ? sql`AND category = ${options.category}` : sql``}
    ORDER BY start_date DESC
  `
}
```

### Error handling patterns

| Situation | Status | Return value |
|-----------|--------|--------------|
| Resource not found | `404` | `{error: '... not found'}` |
| Invalid input from client | `400` | `{error: '...'}` |
| Missing workspace header | `400` | *(handled by workspacePlugin automatically)* |
| Validation failure | `422` | *(handled by Elysia automatically)* |
| Unexpected error | `500` | *(handled by Elysia automatically)* |

### Keep routes thin

Route handlers should be minimal:

1. Call `getSql()` to get the database client.
2. Parse or transform query params with utility functions (e.g., `parseBbox`).
3. Delegate to the appropriate repo function.
4. Handle the `null`/`undefined` case with a `set.status` + error response.
5. Return the result.

Move complex logic (filter building, GeoJSON conversion, validation helpers) into the `lib/` directory:

```
apps/server/src/lib/queryParams.ts   // parseBbox, parseRadius, buildMapPeopleFilters
apps/server/src/lib/geoJson.ts       // mapBucketsToGeoJson
```

### Naming conventions

- Route file: plural noun, snake-case if multi-word (`appointments.ts`, `work-orders.ts`)
- Route prefix: same as filename (`/appointments`, `/work-orders`)
- Route group export: `{resource}Routes` (e.g., `eventRoutes`)
- Repo exports: `list{Resource}`, `get{Resource}ById`, `create{Resource}`, `update{Resource}`, `delete{Resource}`

### Testing

For manual testing during development:

```bash
# Health check
curl http://localhost:3000/health

# Workspace-scoped request
curl http://localhost:3000/v1/events \
  -H "x-workspace-id: 01900000-0000-7000-8000-000000000001"

# Missing header — returns 400
curl http://localhost:3000/v1/events
# => {"error":"Missing x-workspace-id header"}
```

---

## Quick reference: full new-route checklist

- [ ] Create `apps/server/src/routes/<resource>.ts`
- [ ] Import `Elysia`, `t`, `getSql`, repo functions, `workspacePlugin`
- [ ] Define route group with `new Elysia({prefix: '/<resource>'})`
- [ ] Add `.use(workspacePlugin)` before any route handlers
- [ ] Define GET, POST, PATCH, DELETE handlers with typed query/body schemas
- [ ] Export the route group
- [ ] Register in `apps/server/src/app.ts` (import + `.use()`)
- [ ] Create repo functions in `apps/server/src/db/repos/<resource>Repo.ts` (import types from `@doors/api/entities/<resource>`)
- [ ] Add entity + validator modules in `packages/api/src/entities/` and `packages/api/src/validators/`
- [ ] Register new subpaths in `packages/api/package.json` `exports`
- [ ] Re-export client-facing types from `packages/api/src/index.ts` if needed
- [ ] Run `bun run typecheck` to verify no type errors
- [ ] Run `bun run check` to verify lint and format
