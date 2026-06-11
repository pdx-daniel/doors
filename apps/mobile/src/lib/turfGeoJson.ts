import type {TurfResource} from '@doors/api/entities/turf'
import type {GeoJsonFeatureCollection, GeoJsonPolygon} from '@doors/api/geo/geoJson'

/** Minimum vertices required before a turf polygon can be closed. */
export const MIN_TURF_VERTICES = 3

/** GeoJSON properties attached to turf map features. */
export type TurfFeatureProperties = {
  turfId: string
  color: string
  selected: boolean
}

/**
 * Builds a GeoJSON FeatureCollection for rendering saved turfs on the map.
 */
export function buildTurfFeatureCollection(
  turfs: TurfResource[],
  selectedIds: ReadonlySet<string>,
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: turfs.map(turf => ({
      type: 'Feature',
      id: turf.id,
      properties: {
        turfId: turf.id,
        color: turf.color,
        selected: selectedIds.has(turf.id),
      },
      geometry: turf.geometry,
    })),
  }
}

/**
 * Closes a ring of lng/lat pairs into a valid GeoJSON Polygon.
 */
export function closePolygonRing(vertices: [number, number][]): GeoJsonPolygon | null {
  if (vertices.length < MIN_TURF_VERTICES) {
    return null
  }

  const first = vertices[0]
  const last = vertices.at(-1)
  if (!first || !last) {
    return null
  }

  const ring = first[0] === last[0] && first[1] === last[1] ? vertices : [...vertices, first]

  return {
    type: 'Polygon',
    coordinates: [ring],
  }
}

/**
 * Returns true when a map click is within pixelRadius of a lng/lat on the map canvas.
 */
export function isClickNearMapPoint(
  map: {project: (lngLat: {lng: number; lat: number}) => {x: number; y: number}},
  coordinate: [number, number],
  point: {x: number; y: number},
  pixelRadius = 22,
): boolean {
  const projected = map.project({lng: coordinate[0], lat: coordinate[1]})
  const deltaX = projected.x - point.x
  const deltaY = projected.y - point.y

  return Math.hypot(deltaX, deltaY) <= pixelRadius
}

/**
 * Returns true when a click is near the first vertex (within tolerance degrees).
 * Prefer pixel-based hit testing on web when a map instance is available.
 */
export function isNearFirstVertex(
  click: [number, number],
  first: [number, number],
  tolerance = 0.0004,
): boolean {
  const deltaLng = Math.abs(click[0] - first[0])
  const deltaLat = Math.abs(click[1] - first[1])

  return deltaLng <= tolerance && deltaLat <= tolerance
}

/**
 * Finds the index of an existing draft vertex near a click, if any.
 */
export function findNearDraftVertexIndex(
  click: [number, number],
  vertices: [number, number][],
  tolerance = 0.0005,
): number | null {
  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index]
    if (vertex && isNearFirstVertex(click, vertex, tolerance)) {
      return index
    }
  }

  return null
}

/**
 * Reads a draft vertex index from map feature query results.
 */
export function getDraftVertexIndexFromFeatures(
  features: Array<{properties?: Record<string, unknown> | null}>,
): number | null {
  for (const feature of features) {
    const vertexIndex = feature.properties?.vertexIndex
    if (typeof vertexIndex === 'number') {
      return vertexIndex
    }
  }

  return null
}
