import type {
  CreateLocationInput,
  LocationRow,
  UpdateLocationInput,
} from '@doors/api/entities/location'
import type {Bbox} from '@doors/api/geo/bbox'

import {newId} from '../../lib/id'
import type {SqlClient} from '../client'

export type {
  CreateLocationInput,
  LocationRow,
  UpdateLocationInput,
} from '@doors/api/entities/location'

const locationColumns = `
  l.id,
  l.workspace_id AS "workspaceId",
  l.name,
  l.address,
  l.location_type AS "locationType",
  ST_AsGeoJSON(l.geom)::json AS geometry,
  l.created_at AS "createdAt",
  l.updated_at AS "updatedAt"
`

/**
 * Lists locations in a workspace, optionally constrained to a bounding box.
 */
export async function listLocations(
  sql: SqlClient,
  workspaceId: string,
  bbox?: Bbox,
): Promise<LocationRow[]> {
  // Filter by envelope when bbox is provided; otherwise return all workspace locations.
  return await sql<LocationRow[]>`
    SELECT ${sql.unsafe(locationColumns)}
    FROM locations l
    WHERE l.workspace_id = ${workspaceId}
      ${
        bbox
          ? sql`AND l.geom && ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)`
          : sql``
      }
    ORDER BY l.name ASC
  `
}

/**
 * Fetches a single location by id within a workspace.
 */
export async function getLocationById(
  sql: SqlClient,
  workspaceId: string,
  locationId: string,
): Promise<LocationRow | null> {
  const rows = await sql<LocationRow[]>`
    SELECT ${sql.unsafe(locationColumns)}
    FROM locations l
    WHERE l.workspace_id = ${workspaceId}
      AND l.id = ${locationId}
    LIMIT 1
  `

  return rows[0] ?? null
}

/**
 * Creates a location with GeoJSON geometry stored as PostGIS geometry.
 */
export async function createLocation(
  sql: SqlClient,
  input: CreateLocationInput,
): Promise<LocationRow> {
  const id = input.id ?? newId()
  const address = input.address ?? ''
  const locationType = input.locationType ?? 'point'
  const geometryJson = JSON.stringify(input.geometry)

  // Persist the location geometry parsed from GeoJSON.
  const rows = await sql<LocationRow[]>`
    INSERT INTO locations (
      id,
      workspace_id,
      name,
      address,
      location_type,
      geom
    )
    VALUES (
      ${id},
      ${input.workspaceId},
      ${input.name},
      ${address},
      ${locationType},
      ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)
    )
    RETURNING
      id,
      workspace_id AS "workspaceId",
      name,
      address,
      location_type AS "locationType",
      ST_AsGeoJSON(geom)::json AS geometry,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  const row = rows[0]
  if (!row) {
    throw new Error('Failed to create location')
  }

  return row
}

/**
 * Updates mutable location fields within a workspace.
 */
export async function updateLocation(
  sql: SqlClient,
  workspaceId: string,
  locationId: string,
  input: UpdateLocationInput,
): Promise<LocationRow | null> {
  const existing = await getLocationById(sql, workspaceId, locationId)
  if (!existing) {
    return null
  }

  const name = input.name ?? existing.name
  const address = input.address ?? existing.address
  const locationType = input.locationType ?? existing.locationType
  const geometryJson = JSON.stringify(input.geometry ?? existing.geometry)

  // Apply the merged field values and bump updated_at.
  const rows = await sql<LocationRow[]>`
    UPDATE locations
    SET
      name = ${name},
      address = ${address},
      location_type = ${locationType},
      geom = ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326),
      updated_at = now()
    WHERE workspace_id = ${workspaceId}
      AND id = ${locationId}
    RETURNING
      id,
      workspace_id AS "workspaceId",
      name,
      address,
      location_type AS "locationType",
      ST_AsGeoJSON(geom)::json AS geometry,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `

  return rows[0] ?? null
}

/**
 * Deletes a location within a workspace.
 */
export async function deleteLocation(
  sql: SqlClient,
  workspaceId: string,
  locationId: string,
): Promise<boolean> {
  const rows = await sql<{id: string}[]>`
    DELETE FROM locations
    WHERE workspace_id = ${workspaceId}
      AND id = ${locationId}
    RETURNING id
  `

  return rows.length > 0
}
