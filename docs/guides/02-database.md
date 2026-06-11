# Database

This guide covers working with the Doors database: starting PostGIS via Docker, running migrations, seeding dev data, connecting via CLI, and adding new tables and repositories.

- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Starting the database](#starting-the-database)
- [Running migrations](#running-migrations)
- [Seeding data](#seeding-data)
- [Reseeding](#reseeding)
- [Connecting via CLI](#connecting-via-cli)
- [Adding a new migration](#adding-a-new-migration)
- [Adding a new table](#adding-a-new-table)
- [Adding a repository](#adding-a-repository)
- [Best practices](#best-practices)

---

## Architecture

- **PostgreSQL 16** with **PostGIS 3.4**, run via Docker Compose.
- **No ORM.** Database access uses [postgres.js](https://github.com/porsager/postgres) (raw SQL driver).
- **Migrations** are plain SQL files in `apps/server/migrations/`, applied in lexical order.
- **Repositories** live in `apps/server/src/db/repos/` and export typed async functions that accept a `SqlClient` as their first argument.
- **IDs** are UUID v7 (time-sortable) generated via the `uuidv7` package. Use `newId()` from `apps/server/src/lib/id.ts`.

---

## Quick start

```bash
# Copy environment (one-time)
cp .env.example .env

# Start PostGIS
bun run db:up

# Apply migrations
bun run db:migrate

# Seed Portland dev data
bun run db:seed
```

---

## Starting the database

The database runs in a Docker container defined at the repository root.

```yaml
# docker-compose.yml
services:
  db:
    image: postgis/postgis:16-3.4
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: doors
      POSTGRES_PASSWORD: doors
      POSTGRES_DB: doors
    volumes:
      - doors_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U doors -d doors']
      interval: 5s
      timeout: 5s
      retries: 10
```

**Commands:**

| Command | Action |
|---|---|
| `bun run db:up` | Start the database container in background |
| `bun run db:down` | Stop and remove the database container |
| `docker compose logs db` | Tail container logs |
| `docker compose ps` | Check container status |

Data persists in the named volume `doors_pgdata`. To reset from scratch:

```bash
docker compose down -v
bun run db:up
bun run db:migrate
bun run db:seed
```

The health check runs `pg_isready -U doors -d doors`. The container is ready when the health status shows `healthy`.

---

## Running migrations

### How migrations work

- Migration files live in `apps/server/migrations/` and are named with a zero-padded numeric prefix followed by a descriptive name, e.g., `001_init.sql`, `002_add_notes.sql`.
- The migration runner (`apps/server/scripts/migrate.ts`) keeps a ledger table `schema_migrations` that tracks which files have been applied.
- On each run, the script reads all `.sql` files from the migrations directory, sorts them lexically, and applies any file not yet recorded in `schema_migrations`.
- Each migration runs inside a database transaction. If the SQL fails, the transaction rolls back and the migration is not recorded.

### Running

```bash
bun run db:migrate
```

Output:

```
applied migration 001_init.sql
```

Migrations are idempotent — already-applied files are skipped. To reapply a migration, delete its row from `schema_migrations` and run `bun run db:migrate` again.

### The migration ledger

The `schema_migrations` table is created automatically by the first run:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Query applied versions:

```bash
docker compose exec db psql -U doors -d doors -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
```

---

## Seeding data

The seed script (`apps/server/scripts/seed.ts`) populates the database with Portland-area development data.

```bash
bun run db:seed
```

### What is seeded

- **One org workspace** with id `01900000-0000-7000-8000-000000000001` (exported as `DEV_WORKSPACE_ID` from `@doors/api/constants`).
- **20 venue locations** around Portland (offices, community centers, retail spaces, etc.).
- **~70 people** distributed across the venues, each with name, email, phone, metadata (age, gender, occupation), and a location pin.
- **External aliases** for the first 5 people.

### Seeded workspace id

The dev workspace id is set automatically on the Eden Treaty client and is required in the `X-Workspace-Id` header for API routes.

```ts
import {DEV_WORKSPACE_ID} from '@doors/api/constants'

DEV_WORKSPACE_ID
// => '01900000-0000-7000-8000-000000000001'
```

---

## Reseeding

To clear all dev data and reseed:

```bash
bun run db:reseed
```

This runs the same seed script, which first deletes all rows associated with `DEV_WORKSPACE_ID` in dependency order (aliases, people, locations, workspaces) before re-inserting.

---

## Connecting via CLI

### Using docker exec

```bash
docker compose exec db psql -U doors -d doors
```

### Using psql directly

With the default connection string:

```bash
psql postgres://doors:doors@localhost:5432/doors
```

### Common queries

```sql
-- List applied migrations
SELECT version, applied_at FROM schema_migrations ORDER BY version;

-- Check workspace exists
SELECT id, kind, name FROM workspaces;

-- Count seeded data
SELECT count(*) FROM locations;
SELECT count(*) FROM people;
SELECT count(*) FROM person_aliases;

-- Inspect PostGIS version
SELECT postgis_full_version();
```

---

## Adding a new migration

1. Create a new file in `apps/server/migrations/` with the next sequential number:

```bash
touch apps/server/migrations/002_add_notes.sql
```

2. Write your SQL using `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc. so it is safe to re-run.

3. Apply it:

```bash
bun run db:migrate
```

### Naming convention

Use `NNN_descriptive_name.sql` where `NNN` is a three-digit zero-padded number. Examples:

- `001_init.sql`
- `002_add_notes.sql`
- `003_add_tags_table.sql`
- `004_add_location_altitude.sql`

### Guidelines

- Always use `IF NOT EXISTS` / `IF EXISTS` for DDL statements.
- Wrap each semantic change in its own migration so they can be applied independently.
- Do not edit an already-applied migration file. Create a new one instead.

---

## Adding a new table

This example adds a `notes` table that lets users attach text notes to people or locations within a workspace.

### Step 1: Create the migration

`apps/server/migrations/002_add_notes.sql`

```sql
-- Adds the notes table for workspace-scoped user annotations.

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('person', 'location')),
  subject_id UUID NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(body, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_workspace_id ON notes (workspace_id);
CREATE INDEX IF NOT EXISTS idx_notes_author_id ON notes (author_id);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_notes_search_vector ON notes USING GIN (search_vector);
```

**Key patterns demonstrated:**

| Pattern | Implementation |
|---|---|
| **Workspace id foreign key** | `workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE` — every table scoped to a workspace uses this. |
| **UUID primary key** | `id UUID PRIMARY KEY` — populated by the repository layer using `uuidv7`. |
| **Polymorphic foreign key** | `subject_type TEXT` + `subject_id UUID` — used when a row can reference multiple table types. Application-level enforcement happens in the repository. |
| **Search vector** | `tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(body, ''))) STORED` — full-text search without manual indexing. |
| **Timestamps** | `created_at` and `updated_at` with `DEFAULT now()`. `updated_at` is bumped by the repository on updates. |

### Step 2: Apply the migration

```bash
bun run db:migrate
```

### Step 3: Add foreign key indexes

For the polymorphic `subject_id` column, consider partial indexes if you query one subject type more frequently:

```sql
CREATE INDEX IF NOT EXISTS idx_notes_subject_people
  ON notes (subject_id)
  WHERE subject_type = 'person';

CREATE INDEX IF NOT EXISTS idx_notes_subject_locations
  ON notes (subject_id)
  WHERE subject_type = 'location';
```

### Table structure recap

```sql
notes
├── id                  UUID PRIMARY KEY          -- generated via uuidv7
├── workspace_id        UUID FK → workspaces      -- required, cascading delete
├── author_id           UUID FK → people          -- required, cascading delete
├── subject_type        TEXT CHECK(person,location)
├── subject_id          UUID                      -- references either people or locations
├── body                TEXT
├── search_vector       tsvector (generated stored)
├── created_at          TIMESTAMPTZ DEFAULT now()
└── updated_at          TIMESTAMPTZ DEFAULT now()

Indexes:
- workspace_id (btree)
- author_id (btree)
- subject_type + subject_id (composite btree)
- search_vector (gin)
```

---

## Adding a repository

Repositories encapsulate database access for a table. Each repository file exports typed async functions that take a `SqlClient` as their first parameter.

### Step 1: Create the repository file

`apps/server/src/db/repos/noteRepo.ts`

```ts
import type {SqlClient} from '../client'
import {newId} from '../../lib/id'

/** Note row returned from the database. */
export type NoteRow = {
  id: string
  workspaceId: string
  authorId: string
  subjectType: 'person' | 'location'
  subjectId: string
  body: string
  createdAt: string
  updatedAt: string
}

/** Input for creating a note. */
export type CreateNoteInput = {
  id?: string
  workspaceId: string
  authorId: string
  subjectType: 'person' | 'location'
  subjectId: string
  body?: string
}

/** Input for updating a note. */
export type UpdateNoteInput = {
  body?: string
}

const noteColumns = `
  n.id,
  n.workspace_id       AS "workspaceId",
  n.author_id           AS "authorId",
  n.subject_type        AS "subjectType",
  n.subject_id          AS "subjectId",
  n.body,
  n.created_at          AS "createdAt",
  n.updated_at          AS "updatedAt"
`

/**
 * Lists notes for a subject within a workspace.
 */
export async function listNotes(
  sql: SqlClient,
  workspaceId: string,
  subjectType: 'person' | 'location',
  subjectId: string,
): Promise<NoteRow[]> {
  return await sql<NoteRow[]>`
    SELECT ${sql.unsafe(noteColumns)}
    FROM notes n
    WHERE n.workspace_id = ${workspaceId}
      AND n.subject_type = ${subjectType}
      AND n.subject_id = ${subjectId}
    ORDER BY n.created_at DESC
  `
}

/**
 * Fetches a single note by id within a workspace.
 */
export async function getNoteById(
  sql: SqlClient,
  workspaceId: string,
  noteId: string,
): Promise<NoteRow | null> {
  const rows = await sql<NoteRow[]>`
    SELECT ${sql.unsafe(noteColumns)}
    FROM notes n
    WHERE n.workspace_id = ${workspaceId}
      AND n.id = ${noteId}
    LIMIT 1
  `

  return rows[0] ?? null
}

/**
 * Creates a note in a workspace.
 */
export async function createNote(
  sql: SqlClient,
  input: CreateNoteInput,
): Promise<NoteRow> {
  const id = input.id ?? newId()
  const body = input.body ?? ''

  const rows = await sql<NoteRow[]>`
    INSERT INTO notes (id, workspace_id, author_id, subject_type, subject_id, body)
    VALUES (${id}, ${input.workspaceId}, ${input.authorId}, ${input.subjectType}, ${input.subjectId}, ${body})
    RETURNING
      id,
      workspace_id       AS "workspaceId",
      author_id           AS "authorId",
      subject_type        AS "subjectType",
      subject_id          AS "subjectId",
      body,
      created_at          AS "createdAt",
      updated_at          AS "updatedAt"
  `

  const row = rows[0]
  if (!row) {
    throw new Error('Failed to create note')
  }

  return row
}

/**
 * Updates mutable fields on a note within a workspace.
 */
export async function updateNote(
  sql: SqlClient,
  workspaceId: string,
  noteId: string,
  input: UpdateNoteInput,
): Promise<NoteRow | null> {
  const existing = await getNoteById(sql, workspaceId, noteId)
  if (!existing) {
    return null
  }

  const body = input.body ?? existing.body

  const rows = await sql<NoteRow[]>`
    UPDATE notes
    SET body = ${body}, updated_at = now()
    WHERE workspace_id = ${workspaceId}
      AND id = ${noteId}
    RETURNING
      id,
      workspace_id       AS "workspaceId",
      author_id           AS "authorId",
      subject_type        AS "subjectType",
      subject_id          AS "subjectId",
      body,
      created_at          AS "createdAt",
      updated_at          AS "updatedAt"
  `

  return rows[0] ?? null
}

/**
 * Deletes a note within a workspace.
 */
export async function deleteNote(
  sql: SqlClient,
  workspaceId: string,
  noteId: string,
): Promise<boolean> {
  const rows = await sql<{id: string}[]>`
    DELETE FROM notes
    WHERE workspace_id = ${workspaceId}
      AND id = ${noteId}
    RETURNING id
  `

  return rows.length > 0
}
```

### Step 2: Export from a barrel file if desired

If the repository is used outside the server package, add an export to the API package's barrel file.

### Repository conventions

| Convention | Details |
|---|---|
| **File name** | Lowercase, matches table name: `noteRepo.ts`, `personRepo.ts` |
| **First parameter** | Always `sql: SqlClient` — the postgres.js client from `../client` |
| **Type exports** | `Row` type for query results, `CreateInput` / `UpdateInput` for writes |
| **Column aliasing** | Use `AS "camelCase"` in SQL to map `snake_case` DB columns to `camelCase` TypeScript |
| **Workspace scoping** | Every query filters by `workspace_id` |
| **ID generation** | Call `newId()` from `../../lib/id` when no explicit id is provided |
| **Null for not-found** | `get*ById` functions return `T | null` |
| **Bool for delete** | `delete*` functions return `boolean` indicating whether a row was deleted |

---

## Best practices

### Always scope by workspace

Every data table has a `workspace_id` foreign key to `workspaces`. All queries and data access functions must filter by this column. This ensures multi-tenant isolation even before row-level security is added.

### Use raw SQL, not an ORM

Doors uses postgres.js for direct SQL access. This gives full control over query plans, PostGIS functions, and generated columns. Repository functions keep SQL readable and testable.

### Use uuidv7 for primary keys

Always use `uuidv7` (via `newId()`) for UUID generation. UUID v7 values are time-sortable, which improves B-tree index performance compared to random UUIDs and avoids the sequential bottleneck of auto-increment integers.

```ts
import {newId} from '../../lib/id'
const id = newId() // '01900001-0000-7000-8000-000000000001'
```

### One concept per migration

Each migration file should add or change one logical concept (a table, a column, an index). This makes it easy to roll back or reapply a specific change.

### Use generated columns for search vectors

Full-text search columns should be defined as `GENERATED ALWAYS AS (to_tsvector(...)) STORED` so they stay in sync automatically. Add a GIN index on the generated column.

### Bump updated_at on writes

The `updated_at` column must be explicitly set to `now()` in UPDATE statements. PostgreSQL does not do this automatically. The seed script and all repository update functions follow this pattern.

### Prefer composable SQL helpers

Use `sql.unsafe()` for reusable column fragments, not for user-supplied values. Parameterized interpolation (`${value}`) prevents SQL injection.

```ts
// Good — parameterized values
await sql`SELECT * FROM notes WHERE workspace_id = ${workspaceId}`

// Good — safe column fragment
const cols = 'id, workspace_id AS "workspaceId"'
await sql`SELECT ${sql.unsafe(cols)} FROM notes`

// Bad — interpolating identifiers or user input into unsafe
```

### Use `ON DELETE CASCADE` for owned rows

Child tables that are logically owned by a parent (e.g., `notes` owned by `workspaces`) should use `ON DELETE CASCADE` so cleanup is automatic. Use `ON DELETE SET NULL` for optional references that should not delete the referencing row.

### Keep seed data deterministic

The seed script uses fixed UUIDs for venues and people so reseeds produce identical output. Avoid random values in seed data to keep behavior reproducible.
