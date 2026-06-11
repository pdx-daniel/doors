import {mapPeopleQuerySchema} from '@doors/api/validators/mapPeople'
import {Elysia} from 'elysia'

import {getSql} from '../db/client'
import {
  geohashPrecisionForZoom,
  latitudeFromBbox,
  mergeOverlappingMapBuckets,
  snapGridSizeForZoom,
} from '../db/geo/mapGeo'
import {queryPeopleMapBuckets, queryPeopleVisualGroups} from '../db/repos/mapQueryRepo'
import {mapBucketsToGeoJson} from '../lib/geoJson'
import {buildMapPeopleFilters} from '../lib/queryParams'
import {workspacePlugin} from '../middleware/workspacePlugin'

/**
 * Map query routes returning GeoJSON FeatureCollections of people points or clusters.
 */
export const mapRoutes = new Elysia({prefix: '/map'}).use(workspacePlugin).get(
  '/people',
  async ({workspaceId, query}) => {
    const sql = getSql()
    const filters = buildMapPeopleFilters(workspaceId, query)
    const zoom = query.zoom ?? 12
    const clusterMode = query.cluster ?? 'auto'
    const precision = clusterMode === 'false' ? null : geohashPrecisionForZoom(Number(zoom))

    const latitude = latitudeFromBbox(filters.bbox)
    const numericZoom = Number(zoom)

    // Group visually overlapping dots when clustering is disabled or zoom is high enough.
    if (precision === null) {
      const gridSize = snapGridSizeForZoom(numericZoom, latitude)
      const rows = await queryPeopleVisualGroups(sql, filters, gridSize)
      const mergedRows = mergeOverlappingMapBuckets(rows, numericZoom, latitude, 'stack')

      return mapBucketsToGeoJson(mergedRows, 'stack')
    }

    // Aggregate into geohash buckets for low-zoom map views.
    const rows = await queryPeopleMapBuckets(sql, filters, precision)
    const mergedRows = mergeOverlappingMapBuckets(rows, numericZoom, latitude, 'cluster')

    return mapBucketsToGeoJson(mergedRows, 'cluster')
  },
  {
    query: mapPeopleQuerySchema,
  },
)
