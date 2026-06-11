import type postgres from 'postgres'

import type {SqlClient} from '../client'

/** How to combine multiple polygon geometries in a spatial filter. */
export type PolygonMode = 'union' | 'intersection'

type ParsedGeometry = {
  type: string
  coordinates: unknown
}

type ParsedFeature = {
  type: 'Feature'
  geometry?: ParsedGeometry
}

type ParsedFeatureCollection = {
  type: 'FeatureCollection'
  features: ParsedFeature[]
}

/**
 * Extracts polygon/multipolygon GeoJSON strings from a query param value.
 */
export function extractPolygonGeoJsonStrings(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
    return []
  }

  const typed = parsed as {type: string}

  if (typed.type === 'FeatureCollection' && 'features' in parsed) {
    const collection = parsed as ParsedFeatureCollection

    return collection.features
      .map((feature: ParsedFeature) => feature.geometry)
      .filter(
        (geometry: ParsedGeometry | undefined): geometry is ParsedGeometry =>
          geometry !== undefined &&
          (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'),
      )
      .map((geometry: ParsedGeometry) => JSON.stringify(geometry))
  }

  if (typed.type === 'Feature') {
    const feature = parsed as ParsedFeature
    const geometry = feature.geometry
    if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
      return [JSON.stringify(geometry)]
    }

    return []
  }

  if (typed.type === 'Polygon' || typed.type === 'MultiPolygon') {
    return [JSON.stringify(parsed)]
  }

  return []
}

/**
 * Combines geometry SQL fragments with ST_Union or ST_Intersection.
 */
function combineGeometrySql(
  sql: SqlClient,
  geomExpressions: postgres.PendingQuery<postgres.Row[]>[],
  polygonMode: PolygonMode,
): postgres.PendingQuery<postgres.Row[]> | null {
  const first = geomExpressions[0]
  if (!first) {
    return null
  }

  if (geomExpressions.length === 1) {
    return first
  }

  if (polygonMode === 'intersection') {
    let intersection: postgres.PendingQuery<postgres.Row[]> = first
    for (let index = 1; index < geomExpressions.length; index += 1) {
      const next = geomExpressions[index]
      if (next) {
        intersection = sql`ST_Intersection(${intersection}, ${next})`
      }
    }

    return intersection
  }

  let union: postgres.PendingQuery<postgres.Row[]> = first
  for (let index = 1; index < geomExpressions.length; index += 1) {
    const next = geomExpressions[index]
    if (next) {
      union = sql`ST_Union(${union}, ${next})`
    }
  }

  return union
}

/**
 * Builds a PostGIS geometry expression for polygon spatial filtering.
 */
export function buildPolygonGeometrySql(
  sql: SqlClient,
  polygonGeoJson: string,
  polygonMode: PolygonMode = 'union',
): postgres.PendingQuery<postgres.Row[]> | null {
  const geometries = extractPolygonGeoJsonStrings(polygonGeoJson)
  if (geometries.length === 0) {
    return null
  }

  const geomExpressions = geometries.map(
    geoJson => sql`ST_SetSRID(ST_GeomFromGeoJSON(${geoJson}), 4326)`,
  )

  return combineGeometrySql(sql, geomExpressions, polygonMode)
}
