import type {SqlClient} from '../repos/workspaceRepo'
import {newId} from '../repos/workspaceRepo'

/** Location row returned from the database. */
export type LocationRow = {
  id: string
  workspaceId: string
  name: string
  address: string
  locationType: string
  geometry: GeoJsonGeometry
  createdAt: string
  updatedAt: string
}

/** GeoJSON geometry accepted by location create/update APIs. */
export type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

/** Input for creating a location. */
export type CreateLocationInput = {
  id?: string
  workspaceId: string
  name: string
  address?: string
  locationType?: string
  geometry: GeoJsonGeometry
}

/** Input for updating a location. */
export type UpdateLocationInput = {
  name?: string
  address?: string
  locationType?: string
  geometry?: GeoJsonGeometry
}

/** Optional bounding box filter for listing locations. */
export type BboxFilter = {
  west: number
  south: number
  east: number
  north: number
}

/**
 * Lists locations in a workspace, optionally constrained to a bounding box.
 */
export async function listLocations(
  sql: SqlClient,
  workspaceId: string,
  bbox?: BboxFilter,
): Promise<LocationRow[]> {
  if (bbox) {
    // Filter locations whose geometry intersects the requested envelope.
    return await sql<LocationRow[]>`
      SELECT
        l.id,
        l.workspace_id AS "workspaceId",
        l.name,
        l.address,
        l.location_type AS "locationType",
        ST_AsGeoJSON(l.geom)::json AS geometry,
        l.created_at AS "createdAt",
        l.updated_at AS "updatedAt"
      FROM locations l
      WHERE l.workspace_id = ${workspaceId}
        AND l.geom && ST_MakeEnvelope(
          ${bbox.west},
          ${bbox.south},
          ${bbox.east},
          ${bbox.north},
          4326
        )
      ORDER BY l.name ASC
    `
  }

  // Return all locations for the workspace when no bbox is provided.
  return await sql<LocationRow[]>`
    SELECT
      l.id,
      l.workspace_id AS "workspaceId",
      l.name,
      l.address,
      l.location_type AS "locationType",
      ST_AsGeoJSON(l.geom)::json AS geometry,
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt"
    FROM locations l
    WHERE l.workspace_id = ${workspaceId}
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
    SELECT
      l.id,
      l.workspace_id AS "workspaceId",
      l.name,
      l.address,
      l.location_type AS "locationType",
      ST_AsGeoJSON(l.geom)::json AS geometry,
      l.created_at AS "createdAt",
      l.updated_at AS "updatedAt"
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
