import type postgres from 'postgres'
import {uuidv7} from 'uuidv7'

/** postgres.js client type alias used by repository modules. */
export type SqlClient = ReturnType<typeof postgres>

/** Generates a time-sortable UUID v7 string. */
export function newId(): string {
  return uuidv7()
}

/** Supported workspace kinds. */
export type WorkspaceKind = 'personal' | 'org'

/** Workspace row returned from the database. */
export type WorkspaceRow = {
  id: string
  kind: WorkspaceKind
  name: string
  createdAt: string
}

/** Input for creating a workspace. */
export type CreateWorkspaceInput = {
  id?: string
  kind: WorkspaceKind
  name: string
}

/**
 * Inserts a workspace row, returning the persisted record.
 */
export async function createWorkspace(
  sql: SqlClient,
  input: CreateWorkspaceInput,
): Promise<WorkspaceRow> {
  const id = input.id ?? newId()

  // Insert the workspace and map snake_case columns to camelCase.
  const rows = await sql<WorkspaceRow[]>`
    INSERT INTO workspaces (id, kind, name)
    VALUES (${id}, ${input.kind}, ${input.name})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, kind, name, created_at AS "createdAt"
  `

  const row = rows[0]
  if (!row) {
    throw new Error('Failed to create workspace')
  }

  return row
}
