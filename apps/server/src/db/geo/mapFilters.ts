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
 * Snap grid size in degrees for grouping visually overlapping map dots at a zoom level.
 * Targets roughly one grouping cell per ~48 screen pixels at the given latitude.
 */
export function snapGridSizeForZoom(zoom: number, latitude: number): number {
  const overlapPixels = 48
  const latitudeRadians = (latitude * Math.PI) / 180
  const metersPerPixel = (156543.03392 * Math.cos(latitudeRadians)) / 2 ** zoom

  return (overlapPixels * metersPerPixel) / 111_320
}

/** Web Mercator meters per screen pixel at a zoom level and latitude. */
export function metersPerPixelForZoom(zoom: number, latitude: number): number {
  const latitudeRadians = (latitude * Math.PI) / 180

  return (156543.03392 * Math.cos(latitudeRadians)) / 2 ** zoom
}

/**
 * Approximate rendered map marker radius in pixels.
 * Mirrors `peopleCirclePaint` in the mobile map layer so server grouping matches the UI.
 */
export function mapMarkerRadiusPixels(count: number, mode: 'cluster' | 'stack'): number {
  if (mode === 'cluster' && count > 1) {
    return linearInterpolate(count, 1, 12, 100, 28)
  }

  if (count > 1) {
    return linearInterpolate(count, 2, 10, 20, 22)
  }

  return 6
}

/** Great-circle distance in meters between two WGS84 points. */
export function haversineMeters(
  a: {lng: number; lat: number},
  b: {lng: number; lat: number},
): number {
  const earthRadiusMeters = 6_371_000
  const latDelta = ((b.lat - a.lat) * Math.PI) / 180
  const lngDelta = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const haversine =
    Math.sin(latDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine))
}

/**
 * Merges map buckets whose rendered circles would overlap at the given zoom.
 * Fixes geohash and snap-grid boundary splits that leave stacked dots on screen.
 */
export function mergeOverlappingMapBuckets(
  rows: MapBucketRow[],
  zoom: number,
  latitude: number,
  mode: 'cluster' | 'stack',
): MapBucketRow[] {
  if (rows.length <= 1) {
    return rows
  }

  const metersPerPixel = metersPerPixelForZoom(zoom, latitude)
  const strokePixels = 2
  const parent = rows.map((_, index) => index)

  const findRoot = (index: number): number => {
    let current = index

    while (parent[current] !== current) {
      parent[current] = parent[parent[current] ?? current] ?? current
      current = parent[current] ?? current
    }

    return current
  }

  const unionRoots = (left: number, right: number): void => {
    const leftRoot = findRoot(left)
    const rightRoot = findRoot(right)

    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot
    }
  }

  // Union buckets whose screen-space marker footprints overlap.
  for (let left = 0; left < rows.length; left += 1) {
    const leftRow = rows[left]

    if (!leftRow) {
      continue
    }

    for (let right = left + 1; right < rows.length; right += 1) {
      const rightRow = rows[right]

      if (!rightRow) {
        continue
      }

      const overlapRadiusPixels =
        mapMarkerRadiusPixels(leftRow.count, mode) +
        mapMarkerRadiusPixels(rightRow.count, mode) +
        strokePixels
      const overlapMeters = overlapRadiusPixels * metersPerPixel

      if (haversineMeters(leftRow, rightRow) <= overlapMeters) {
        unionRoots(left, right)
      }
    }
  }

  const groupedRows = new Map<number, MapBucketRow[]>()

  // Collect each connected overlap component.
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]

    if (!row) {
      continue
    }

    const root = findRoot(index)
    const group = groupedRows.get(root) ?? []
    group.push(row)
    groupedRows.set(root, group)
  }

  // Collapse each overlap component into one bucket row.
  return [...groupedRows.values()].map(group => mergeMapBucketGroup(group))
}

function linearInterpolate(
  value: number,
  minIn: number,
  minOut: number,
  maxIn: number,
  maxOut: number,
): number {
  if (value <= minIn) {
    return minOut
  }

  if (value >= maxIn) {
    return maxOut
  }

  const ratio = (value - minIn) / (maxIn - minIn)

  return minOut + ratio * (maxOut - minOut)
}

function mergeMapBucketGroup(group: MapBucketRow[]): MapBucketRow {
  const totalCount = group.reduce((sum, row) => sum + row.count, 0)
  const weightedLng =
    group.reduce((sum, row) => sum + row.lng * row.count, 0) / Math.max(totalCount, 1)
  const weightedLat =
    group.reduce((sum, row) => sum + row.lat * row.count, 0) / Math.max(totalCount, 1)
  const representative = group.reduce((best, row) => (row.count > best.count ? row : best))

  return {
    ...representative,
    geohash: representative.geohash,
    count: totalCount,
    lng: weightedLng,
    lat: weightedLat,
  }
}

/**
 * Picks a representative latitude for snap sizing from an optional bounding box.
 */
export function latitudeFromBbox(bbox: Bbox | undefined): number {
  if (!bbox) {
    return 45.5
  }

  return (bbox.south + bbox.north) / 2
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
