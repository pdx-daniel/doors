import type {CreateTurfInput, TurfRow, UpdateTurfInput} from '@doors/api/entities/turf'

import {newId} from '../../lib/id'
import {randomTurfColor} from '../../lib/turfColor'
import type {SqlClient} from '../client'

export type {CreateTurfInput, TurfRow, UpdateTurfInput} from '@doors/api/entities/turf'

const turfColumns = `
  t.id,
  t.workspace_id AS "workspaceId",
  t.location_id AS "locationId",
  l.name,
  t.color,
  ST_AsGeoJSON(l.geom)::json AS geometry,
  t.metadata,
  t.created_at AS "createdAt",
  t.updated_at AS "updatedAt"
`

/**
 * Lists all turfs in a workspace with linked location geometry.
 */
export async function listTurfs(sql: SqlClient, workspaceId: string): Promise<TurfRow[]> {
  return await sql<TurfRow[]>`
    SELECT ${sql.unsafe(turfColumns)}
    FROM turfs t
    INNER JOIN locations l ON l.id = t.location_id
    WHERE t.workspace_id = ${workspaceId}
    ORDER BY t.created_at ASC
  `
}

/**
 * Fetches a single turf by id within a workspace.
 */
export async function getTurfById(
  sql: SqlClient,
  workspaceId: string,
  turfId: string,
): Promise<TurfRow | null> {
  const rows = await sql<TurfRow[]>`
    SELECT ${sql.unsafe(turfColumns)}
    FROM turfs t
    INNER JOIN locations l ON l.id = t.location_id
    WHERE t.workspace_id = ${workspaceId}
      AND t.id = ${turfId}
    LIMIT 1
  `

  return rows[0] ?? null
}

/**
 * Creates a turf and linked polygon location in one transaction.
 */
export async function createTurf(sql: SqlClient, input: CreateTurfInput): Promise<TurfRow> {
  const turfId = input.id ?? newId()
  const locationId = newId()
  const name = input.name ?? ''
  const color = input.color ?? randomTurfColor()
  const geometryJson = JSON.stringify(input.geometry)

  return await sql.begin(async tx => {
    // Insert the polygon location row first.
    await tx`
      INSERT INTO locations (
        id,
        workspace_id,
        name,
        address,
        location_type,
        geom
      )
      VALUES (
        ${locationId},
        ${input.workspaceId},
        ${name},
        '',
        'turf',
        ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)
      )
    `

    // Link turf metadata to the new location.
    const rows = await tx<TurfRow[]>`
      INSERT INTO turfs (
        id,
        workspace_id,
        location_id,
        color
      )
      VALUES (
        ${turfId},
        ${input.workspaceId},
        ${locationId},
        ${color}
      )
      RETURNING
        id,
        workspace_id AS "workspaceId",
        location_id AS "locationId",
        ${name} AS name,
        color,
        ST_AsGeoJSON(
          (SELECT geom FROM locations WHERE id = ${locationId})
        )::json AS geometry,
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `

    const row = rows[0]
    if (!row) {
      throw new Error('Failed to create turf')
    }

    return row
  })
}

/**
 * Updates turf metadata and optional linked location name/geometry.
 */
export async function updateTurf(
  sql: SqlClient,
  workspaceId: string,
  turfId: string,
  input: UpdateTurfInput,
): Promise<TurfRow | null> {
  const existing = await getTurfById(sql, workspaceId, turfId)
  if (!existing) {
    return null
  }

  const name = input.name ?? existing.name
  const color = input.color ?? existing.color
  const geometryJson = JSON.stringify(input.geometry ?? existing.geometry)

  // Update linked location geometry/name when provided.
  await sql`
    UPDATE locations
    SET
      name = ${name},
      geom = ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326),
      updated_at = now()
    WHERE workspace_id = ${workspaceId}
      AND id = ${existing.locationId}
  `

  const rows = await sql<TurfRow[]>`
    UPDATE turfs
    SET
      color = ${color},
      updated_at = now()
    WHERE workspace_id = ${workspaceId}
      AND id = ${turfId}
    RETURNING
      id,
      workspace_id AS "workspaceId",
      location_id AS "locationId",
      ${name} AS name,
      color,
      ST_AsGeoJSON(
        (SELECT geom FROM locations WHERE id = ${existing.locationId})
      )::json AS geometry,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  return rows[0] ?? null
}

/**
 * Deletes a turf row; linked location is removed via ON DELETE CASCADE from turfs FK.
 */
export async function deleteTurf(
  sql: SqlClient,
  workspaceId: string,
  turfId: string,
): Promise<boolean> {
  const existing = await getTurfById(sql, workspaceId, turfId)
  if (!existing) {
    return false
  }

  return await sql.begin(async tx => {
    // Delete turf first so location cascade is explicit in both directions.
    const turfRows = await tx<{id: string}[]>`
      DELETE FROM turfs
      WHERE workspace_id = ${workspaceId}
        AND id = ${turfId}
      RETURNING id
    `

    if (turfRows.length === 0) {
      return false
    }

    // Remove the linked polygon location.
    await tx`
      DELETE FROM locations
      WHERE workspace_id = ${workspaceId}
        AND id = ${existing.locationId}
    `

    return true
  })
}
