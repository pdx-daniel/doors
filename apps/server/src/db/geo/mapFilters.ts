/** Bounding box in WGS84 decimal degrees. */
export type Bbox = {
  west: number
  south: number
  east: number
  north: number
}

/** Radius filter centered on a WGS84 point. */
export type RadiusFilter = {
  lng: number
  lat: number
  meters: number
}

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

/** Individual person map point row from PostGIS. */
export type PersonPointRow = {
  personId: string
  displayName: string
  email: string
  phone: string
  locationId: string
  locationName: string
  locationType: string
  metadata: Record<string, unknown>
  lng: number
  lat: number
}

/**
 * Converts $.occupation style paths to a safe jsonb object key.
 */
export function metadataFieldKey(fieldPath: string): string {
  return fieldPath.replace(/^\$\./, '').replace(/[^a-zA-Z0-9_]/g, '')
}

/** Histogram bucket row grouped by metadata field value. */
export type HistogramBucketRow = {
  value: string
  count: number
}

/**
 * Maps a map zoom level to a GeoHash precision for server-side clustering.
 */
export function geohashPrecisionForZoom(zoom: number): number | null {
  if (zoom >= 14) {
    return null
  }

  if (zoom >= 12) {
    return 7
  }

  if (zoom >= 10) {
    return 6
  }

  if (zoom >= 8) {
    return 5
  }

  return 4
}

/**
 * Builds SQL fragments and parameter values shared by map query functions.
 */
export function buildMapFilterFragments(filters: MapPeopleFilters): {
  geoSql: string
  searchSql: string
  locationTypeSql: string
  jsonPathSql: string
} {
  const geoParts: string[] = ['l.geom IS NOT NULL']
  const searchParts: string[] = []
  const locationTypeParts: string[] = []
  const jsonPathParts: string[] = []

  if (filters.bbox) {
    geoParts.push(
      `l.geom && ST_MakeEnvelope(${filters.bbox.west}, ${filters.bbox.south}, ${filters.bbox.east}, ${filters.bbox.north}, 4326)`,
    )
  }

  if (filters.radius) {
    geoParts.push(
      `ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint(${filters.radius.lng}, ${filters.radius.lat}), 4326)::geography, ${filters.radius.meters})`,
    )
  }

  if (filters.polygonGeoJson) {
    const escaped = filters.polygonGeoJson.replaceAll("'", "''")
    geoParts.push(`ST_Intersects(l.geom, ST_SetSRID(ST_GeomFromGeoJSON('${escaped}'), 4326))`)
  }

  if (filters.query) {
    const escaped = filters.query.replaceAll("'", "''")
    searchParts.push(
      `(p.search_vector @@ plainto_tsquery('english', '${escaped}') OR l.search_vector @@ plainto_tsquery('english', '${escaped}'))`,
    )
  }

  if (filters.locationType) {
    const escaped = filters.locationType.replaceAll("'", "''")
    locationTypeParts.push(`l.location_type = '${escaped}'`)
  }

  if (filters.jsonPath) {
    const escaped = filters.jsonPath.replaceAll("'", "''")
    jsonPathParts.push(`p.metadata @? '${escaped}'`)
  }

  return {
    geoSql: geoParts.join(' AND '),
    searchSql: searchParts.length > 0 ? searchParts.join(' AND ') : 'TRUE',
    locationTypeSql: locationTypeParts.length > 0 ? locationTypeParts.join(' AND ') : 'TRUE',
    jsonPathSql: jsonPathParts.length > 0 ? jsonPathParts.join(' AND ') : 'TRUE',
  }
}
