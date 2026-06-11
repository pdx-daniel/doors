import type {GeoJsonFeatureCollection} from '@doors/api/schemas'

import type {ClusterRow, MapBucketRow, PersonPointRow} from '../db/geo/mapFilters'

/** GeoJSON FeatureCollection for clustered map points. */
export function clustersToGeoJson(rows: ClusterRow[]): GeoJsonFeatureCollection {
  return mapBucketsToGeoJson(
    rows.map(row => ({
      ...row,
      personId: null,
      displayName: null,
      email: null,
      phone: null,
      locationId: null,
      locationName: null,
      locationType: null,
      metadata: null,
    })),
  )
}

/** GeoJSON FeatureCollection mixing multi-person clusters and singleton person dots. */
export function mapBucketsToGeoJson(rows: MapBucketRow[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map(row => {
      // Emit a person dot when a geohash cell only contains one person.
      if (row.count <= 1 && row.personId) {
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [row.lng, row.lat],
          },
          properties: {
            cluster: false as const,
            personId: row.personId,
            displayName: row.displayName ?? '',
            email: row.email ?? '',
            phone: row.phone ?? '',
            locationId: row.locationId ?? '',
            locationName: row.locationName ?? '',
            locationType: row.locationType ?? '',
            metadata: row.metadata ?? {},
          },
        }
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [row.lng, row.lat],
        },
        properties: {
          cluster: true as const,
          count: row.count,
          geohash: row.geohash,
        },
      }
    }),
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
