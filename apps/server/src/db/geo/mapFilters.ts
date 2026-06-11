import type {Bbox, RadiusFilter} from '@doors/api/schemas'
import type postgres from 'postgres'

import type {SqlClient} from '../client'

/** Shared geo and search filters for map queries. */
export type MapPeopleFilters = {
  workspaceId: string
  bbox?: Bbox | undefined
  radius?: RadiusFilter | undefined
  polygonGeoJson?: string | undefined
  locationType?: string | undefined
  query?: string | undefined
  jsonPath?: string | undefined
}

/** Cluster aggregation row from PostGIS. */
export type ClusterRow = {
  geohash: string
  count: number
  lng: number
  lat: number
}

/** Mixed cluster/person bucket row from a single grouped map query. */
export type MapBucketRow = ClusterRow & {
  personId: string | null
  displayName: string | null
  email: string | null
  phone: string | null
  locationId: string | null
  locationName: string | null
  locationType: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Converts $.occupation style paths to a safe jsonb object key.
 */
export function metadataFieldKey(fieldPath: string): string {
  return fieldPath.replace(/^\$\./, '').replace(/[^a-zA-Z0-9_]/g, '')
}

/**
 * Builds a parameterized WHERE clause shared by map query functions.
 */
export function buildMapWhereClause(
  sql: SqlClient,
  filters: MapPeopleFilters,
): postgres.PendingQuery<postgres.Row[]> {
  return sql`
    p.workspace_id = ${filters.workspaceId}
    AND p.location_id IS NOT NULL
    AND l.geom IS NOT NULL
    ${filters.bbox ? sql`AND l.geom && ST_MakeEnvelope(${filters.bbox.west}, ${filters.bbox.south}, ${filters.bbox.east}, ${filters.bbox.north}, 4326)` : sql``}
    ${filters.radius ? sql`AND ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint(${filters.radius.lng}, ${filters.radius.lat}), 4326)::geography, ${filters.radius.meters})` : sql``}
    ${filters.polygonGeoJson ? sql`AND ST_Intersects(l.geom, ST_SetSRID(ST_GeomFromGeoJSON(${filters.polygonGeoJson}), 4326))` : sql``}
    ${filters.query ? sql`AND (p.search_vector @@ plainto_tsquery('english', ${filters.query}) OR l.search_vector @@ plainto_tsquery('english', ${filters.query}))` : sql``}
    ${filters.locationType ? sql`AND l.location_type = ${filters.locationType}` : sql``}
    ${filters.jsonPath ? sql`AND p.metadata @? ${filters.jsonPath}` : sql``}
  `
}
