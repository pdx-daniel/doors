import type {GeoJsonFeatureCollection, MapPeopleFeature} from '@doors/api/geo/mapPeople'

import type {MapBucketRow} from '../db/geo/mapFilters'

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
