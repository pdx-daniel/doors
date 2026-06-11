import {
  buildMapFilterFragments,
  type ClusterRow,
  type HistogramBucketRow,
  type MapPeopleFilters,
  type PersonPointRow,
} from '../geo/mapFilters'
import type {SqlClient} from './workspaceRepo'

/**
 * Queries clustered people counts grouped by GeoHash cells.
 */
export async function queryPeopleClusters(
  sql: SqlClient,
  filters: MapPeopleFilters,
  precision: number,
): Promise<ClusterRow[]> {
  const {geoSql, searchSql, locationTypeSql, jsonPathSql} = buildMapFilterFragments(filters)

  // Aggregate people into geohash buckets for low-zoom map rendering.
  return await sql.unsafe<ClusterRow[]>(`
    SELECT
      ST_GeoHash(l.geom, ${precision}) AS geohash,
      COUNT(*)::int AS count,
      ST_X(ST_Centroid(ST_Collect(l.geom))) AS lng,
      ST_Y(ST_Centroid(ST_Collect(l.geom))) AS lat
    FROM people p
    INNER JOIN locations l ON l.id = p.location_id
    WHERE p.workspace_id = '${filters.workspaceId}'
      AND p.location_id IS NOT NULL
      AND ${geoSql}
      AND ${searchSql}
      AND ${locationTypeSql}
      AND ${jsonPathSql}
    GROUP BY ST_GeoHash(l.geom, ${precision})
    ORDER BY count DESC
  `)
}

/**
 * Queries individual people as map points for high-zoom rendering.
 */
export async function queryPeoplePoints(
  sql: SqlClient,
  filters: MapPeopleFilters,
): Promise<PersonPointRow[]> {
  const {geoSql, searchSql, locationTypeSql, jsonPathSql} = buildMapFilterFragments(filters)

  // Return one point per person using the linked location geometry.
  return await sql.unsafe<PersonPointRow[]>(`
    SELECT
      p.id AS "personId",
      p.display_name AS "displayName",
      p.email,
      p.phone,
      l.id AS "locationId",
      l.name AS "locationName",
      l.location_type AS "locationType",
      p.metadata,
      ST_X(l.geom) AS lng,
      ST_Y(l.geom) AS lat
    FROM people p
    INNER JOIN locations l ON l.id = p.location_id
    WHERE p.workspace_id = '${filters.workspaceId}'
      AND p.location_id IS NOT NULL
      AND ${geoSql}
      AND ${searchSql}
      AND ${locationTypeSql}
      AND ${jsonPathSql}
    ORDER BY p.display_name ASC
  `)
}

/**
 * Builds a histogram of metadata values for people matching map filters.
 */
export async function queryPeopleHistogram(
  sql: SqlClient,
  filters: MapPeopleFilters,
  fieldKey: string,
): Promise<HistogramBucketRow[]> {
  const {geoSql, searchSql, locationTypeSql, jsonPathSql} = buildMapFilterFragments(filters)

  // Group by a JSON metadata field extracted from jsonb.
  return await sql.unsafe<HistogramBucketRow[]>(`
    SELECT
      COALESCE(p.metadata ->> '${fieldKey}', '(null)') AS value,
      COUNT(*)::int AS count
    FROM people p
    INNER JOIN locations l ON l.id = p.location_id
    WHERE p.workspace_id = '${filters.workspaceId}'
      AND p.location_id IS NOT NULL
      AND ${geoSql}
      AND ${searchSql}
      AND ${locationTypeSql}
      AND ${jsonPathSql}
    GROUP BY value
    ORDER BY count DESC, value ASC
  `)
}
