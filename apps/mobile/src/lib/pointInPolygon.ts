import type {TurfResource} from '@doors/api/entities/turf'
import type {GeoJsonPolygon} from '@doors/api/geo/geoJson'

/**
 * Ray-casting test for whether a point lies inside a GeoJSON polygon ring.
 */
export function pointInPolygon(lng: number, lat: number, polygon: GeoJsonPolygon): boolean {
  const ring = polygon.coordinates[0]
  if (!ring || ring.length < 4) {
    return false
  }

  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index]
    const prior = ring[previous]
    if (!current || !prior) {
      continue
    }

    const [xi, yi] = current
    const [xj, yj] = prior
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Finds the top-most turf containing the given map coordinate.
 */
export function findTurfAtCoordinate(
  turfs: TurfResource[],
  lng: number,
  lat: number,
): TurfResource | null {
  for (let index = turfs.length - 1; index >= 0; index -= 1) {
    const turf = turfs[index]
    if (
      turf?.geometry.type === 'Polygon' &&
      pointInPolygon(lng, lat, turf.geometry as GeoJsonPolygon)
    ) {
      return turf
    }
  }

  return null
}
