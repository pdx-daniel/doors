import type {HistogramBucket} from '@doors/api/schemas'

import type {SqlClient} from '../client'
import {buildMapWhereClause, type MapBucketRow, type MapPeopleFilters} from '../geo/mapFilters'

type PeopleMapQueryOptions = {
  groupExpression: string
  groupAlias: string
}

/**
 * Shared people-at-locations query grouped by a PostGIS expression.
 */
async function queryPeopleMapGroups(
  sql: SqlClient,
  filters: MapPeopleFilters,
  options: PeopleMapQueryOptions,
): Promise<MapBucketRow[]> {
  const whereClause = buildMapWhereClause(sql, filters)

  // Aggregate once per spatial group and pick representative person fields for singletons.
  return await sql<MapBucketRow[]>`
    SELECT
      ${sql.unsafe(options.groupExpression)} AS ${sql.unsafe(options.groupAlias)},
      COUNT(*)::int AS count,
      ST_X(ST_Centroid(ST_Collect(l.geom))) AS lng,
      ST_Y(ST_Centroid(ST_Collect(l.geom))) AS lat,
      (array_agg(p.id ORDER BY p.id))[1] AS "personId",
      (array_agg(p.display_name ORDER BY p.id))[1] AS "displayName",
      (array_agg(p.email ORDER BY p.id))[1] AS email,
      (array_agg(p.phone ORDER BY p.id))[1] AS phone,
      (array_agg(l.id ORDER BY p.id))[1] AS "locationId",
      (array_agg(l.name ORDER BY p.id))[1] AS "locationName",
      (array_agg(l.location_type ORDER BY p.id))[1] AS "locationType",
      (array_agg(p.metadata ORDER BY p.id))[1] AS metadata
    FROM people p
    INNER JOIN locations l ON l.id = p.location_id
    WHERE ${whereClause}
    GROUP BY ${sql.unsafe(options.groupExpression)}
    ORDER BY count DESC
  `
}

/**
 * Queries geohash buckets for low-zoom map rendering.
 * Multi-person cells become clusters; singleton cells include person metadata.
 */
export async function queryPeopleMapBuckets(
  sql: SqlClient,
  filters: MapPeopleFilters,
  precision: number,
): Promise<MapBucketRow[]> {
  return await queryPeopleMapGroups(sql, filters, {
    groupExpression: `ST_GeoHash(l.geom, ${precision})`,
    groupAlias: 'geohash',
  })
}

/**
 * Queries zoom-aware visual groups for high-zoom map rendering.
 * Groups exact and nearly-overlapping coordinates using a snap grid.
 */
export async function queryPeopleVisualGroups(
  sql: SqlClient,
  filters: MapPeopleFilters,
  gridSize: number,
): Promise<MapBucketRow[]> {
  return await queryPeopleMapGroups(sql, filters, {
    groupExpression: `ST_SnapToGrid(l.geom, ${gridSize})`,
    groupAlias: 'geohash',
  })
}

/**
 * Builds a histogram of metadata values for people matching map filters.
 */
export async function queryPeopleHistogram(
  sql: SqlClient,
  filters: MapPeopleFilters,
  fieldKey: string,
): Promise<HistogramBucket[]> {
  const whereClause = buildMapWhereClause(sql, filters)

  // Group by a JSON metadata field extracted from jsonb.
  return await sql<HistogramBucket[]>`
    SELECT
      COALESCE(p.metadata ->> ${fieldKey}, '(null)') AS value,
      COUNT(*)::int AS count
    FROM people p
    INNER JOIN locations l ON l.id = p.location_id
    WHERE ${whereClause}
    GROUP BY value
    ORDER BY count DESC, value ASC
  `
}
