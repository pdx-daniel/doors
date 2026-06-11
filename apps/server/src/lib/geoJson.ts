import type {GeoJsonFeatureCollection, MapPeopleFeature} from '@doors/api/schemas'

import type {ClusterRow, MapBucketRow, PersonPointRow} from '../db/geo/mapFilters'

/** Builds a GeoJSON person feature from a grouped bucket row. */
function personFeatureFromBucket(row: MapBucketRow, stacked: boolean): MapPeopleFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [row.lng, row.lat],
    },
    properties: {
      cluster: false,
      stacked,
      count: row.count,
      personId: row.personId ?? '',
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

/** Builds a GeoJSON geohash cluster feature from a grouped bucket row. */
function clusterFeatureFromBucket(row: MapBucketRow): MapPeopleFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [row.lng, row.lat],
    },
    properties: {
      cluster: true,
      stacked: false,
      count: row.count,
      geohash: row.geohash,
    },
  }
}

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
    'cluster',
  )
}

/**
 * GeoJSON FeatureCollection mixing geohash clusters, co-located stacks, and singletons.
 */
export function mapBucketsToGeoJson(
  rows: MapBucketRow[],
  mode: 'cluster' | 'stack' = 'cluster',
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map(row => {
      if (row.count <= 1 && row.personId) {
        return personFeatureFromBucket(row, false)
      }

      if (mode === 'cluster') {
        return clusterFeatureFromBucket(row)
      }

      return personFeatureFromBucket(row, true)
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
        stacked: false,
        count: 1,
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
