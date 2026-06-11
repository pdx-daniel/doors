import type {GeoJsonFeatureCollection} from '@doors/api/schemas'

import type {ClusterRow, PersonPointRow} from '../db/geo/mapFilters'

/** GeoJSON FeatureCollection for clustered map points. */
export function clustersToGeoJson(rows: ClusterRow[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map(row => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [row.lng, row.lat],
      },
      properties: {
        cluster: true,
        count: row.count,
        geohash: row.geohash,
      },
    })),
  }
}

/** GeoJSON FeatureCollection for individual person map points. */
export function peoplePointsToGeoJson(rows: PersonPointRow[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map(row => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [row.lng, row.lat],
      },
      properties: {
        cluster: false,
        personId: row.personId,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        locationId: row.locationId,
        locationName: row.locationName,
        locationType: row.locationType,
        metadata: row.metadata,
      },
    })),
  }
}
