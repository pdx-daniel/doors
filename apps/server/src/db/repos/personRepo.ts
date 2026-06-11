import type postgres from 'postgres'

import type {SqlClient} from '../repos/workspaceRepo'
import {newId} from '../repos/workspaceRepo'

/** Person row returned from the database. */
export type PersonRow = {
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

/** Input for creating a person. */
export type CreatePersonInput = {
  id?: string
  workspaceId: string
  displayName: string
  email?: string
  phone?: string
  locationId?: string | null
  metadata?: Record<string, unknown>
}

/** Input for updating a person. */
export type UpdatePersonInput = {
  displayName?: string
  email?: string
  phone?: string
  locationId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Lists all people in a workspace ordered by display name.
 */
export async function listPeople(sql: SqlClient, workspaceId: string): Promise<PersonRow[]> {
  return await sql<PersonRow[]>`
    SELECT
      p.id,
      p.workspace_id AS "workspaceId",
      p.display_name AS "displayName",
      p.email,
      p.phone,
      p.location_id AS "locationId",
      p.metadata,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
    FROM people p
    WHERE p.workspace_id = ${workspaceId}
    ORDER BY p.display_name ASC
  `
}

/**
 * Fetches a single person by id within a workspace.
 */
export async function getPersonById(
  sql: SqlClient,
  workspaceId: string,
  personId: string,
): Promise<PersonRow | null> {
  const rows = await sql<PersonRow[]>`
    SELECT
      p.id,
      p.workspace_id AS "workspaceId",
      p.display_name AS "displayName",
      p.email,
      p.phone,
      p.location_id AS "locationId",
      p.metadata,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
    FROM people p
    WHERE p.workspace_id = ${workspaceId}
      AND p.id = ${personId}
    LIMIT 1
  `

  return rows[0] ?? null
}

/**
 * Creates a person row in a workspace.
 */
export async function createPerson(sql: SqlClient, input: CreatePersonInput): Promise<PersonRow> {
  const id = input.id ?? newId()
  const email = input.email ?? ''
  const phone = input.phone ?? ''
  const metadata = input.metadata ?? {}
  const locationId = input.locationId ?? null

  // Insert the person with JSON metadata stored in jsonb.
  const rows = await sql<PersonRow[]>`
    INSERT INTO people (
      id,
      workspace_id,
      display_name,
      email,
      phone,
      location_id,
      metadata
    )
    VALUES (
      ${id},
      ${input.workspaceId},
      ${input.displayName},
      ${email},
      ${phone},
      ${locationId},
      ${sql.json(metadata as postgres.JSONValue)}
    )
    RETURNING
      id,
      workspace_id AS "workspaceId",
      display_name AS "displayName",
      email,
      phone,
      location_id AS "locationId",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  const row = rows[0]
  if (!row) {
    throw new Error('Failed to create person')
  }

  return row
}

/**
 * Updates mutable person fields within a workspace.
 */
export async function updatePerson(
  sql: SqlClient,
  workspaceId: string,
  personId: string,
  input: UpdatePersonInput,
): Promise<PersonRow | null> {
  const existing = await getPersonById(sql, workspaceId, personId)
  if (!existing) {
    return null
  }

  const displayName = input.displayName ?? existing.displayName
  const email = input.email ?? existing.email
  const phone = input.phone ?? existing.phone
  const locationId = input.locationId === undefined ? existing.locationId : input.locationId
  const metadata = input.metadata ?? existing.metadata

  // Apply merged values and refresh updated_at.
  const rows = await sql<PersonRow[]>`
    UPDATE people
    SET
      display_name = ${displayName},
      email = ${email},
      phone = ${phone},
      location_id = ${locationId},
      metadata = ${sql.json(metadata as postgres.JSONValue)},
      updated_at = now()
    WHERE workspace_id = ${workspaceId}
      AND id = ${personId}
    RETURNING
      id,
      workspace_id AS "workspaceId",
      display_name AS "displayName",
      email,
      phone,
      location_id AS "locationId",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  return rows[0] ?? null
}

/**
 * Deletes a person within a workspace.
 */
export async function deletePerson(
  sql: SqlClient,
  workspaceId: string,
  personId: string,
): Promise<boolean> {
  const rows = await sql<{id: string}[]>`
    DELETE FROM people
    WHERE workspace_id = ${workspaceId}
      AND id = ${personId}
    RETURNING id
  `

  return rows.length > 0
}

/**
 * Inserts an external id alias for a person.
 */
export async function createPersonAlias(
  sql: SqlClient,
  input: {
    id?: string
    workspaceId: string
    personId: string
    source: string
    externalId: string
  },
): Promise<void> {
  const id = input.id ?? newId()

  // Upsert alias rows keyed by workspace, source, and external id.
  await sql`
    INSERT INTO person_aliases (id, workspace_id, person_id, source, external_id)
    VALUES (${id}, ${input.workspaceId}, ${input.personId}, ${input.source}, ${input.externalId})
    ON CONFLICT (workspace_id, source, external_id) DO UPDATE
      SET person_id = EXCLUDED.person_id
  `
}
