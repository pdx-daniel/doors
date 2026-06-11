import {Elysia, t} from 'elysia'

import {getSql} from '../db/client'
import type {MapPeopleFilters} from '../db/geo/mapFilters'
import {
  geohashPrecisionForZoom,
  latitudeFromBbox,
  mergeOverlappingMapBuckets,
  snapGridSizeForZoom,
} from '../db/geo/mapFilters'
import {queryPeopleMapBuckets, queryPeopleVisualGroups} from '../db/repos/mapQueryRepo'
import {mapBucketsToGeoJson} from '../lib/geoJson'
import {missingWorkspaceResponse, readWorkspaceId} from '../middleware/workspace'

/**
 * Parses comma-separated bbox query param into numeric bounds.
 */
function parseBbox(raw: string | undefined): MapPeopleFilters['bbox'] {
  if (!raw) {
    return undefined
  }

  const parts = raw.split(',').map(Number)
  return {
    west: parts[0] ?? 0,
    south: parts[1] ?? 0,
    east: parts[2] ?? 0,
    north: parts[3] ?? 0,
  }
}

/**
 * Parses comma-separated radius query param into center + meters.
 */
function parseRadius(raw: string | undefined): MapPeopleFilters['radius'] {
  if (!raw) {
    return undefined
  }

  const parts = raw.split(',').map(Number)
  return {
    lng: parts[0] ?? 0,
    lat: parts[1] ?? 0,
    meters: parts[2] ?? 0,
  }
}

/**
 * Parses filter=location_type=venue style query param.
 */
function parseLocationTypeFilter(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined
  }

  const [key, value] = raw.split('=')
  if (key === 'location_type' && value) {
    return value
  }

  return undefined
}

/**
 * Builds shared map query filters from route query params.
 */
function buildFilters(workspaceId: string, query: MapQueryParams): MapPeopleFilters {
  return {
    workspaceId,
    bbox: parseBbox(query.bbox),
    radius: parseRadius(query.radius),
    polygonGeoJson: query.polygon,
    locationType: parseLocationTypeFilter(query.filter),
    query: query.q,
    jsonPath: query.jsonpath,
  }
}

type MapQueryParams = {
  bbox?: string
  radius?: string
  polygon?: string
  zoom?: number
  q?: string
  filter?: string
  jsonpath?: string
  cluster?: string
}

/**
 * Map query routes returning GeoJSON FeatureCollections of people points or clusters.
 */
export const mapRoutes = new Elysia({prefix: '/map'}).get(
  '/people',
  async ({headers, query, set}) => {
    const workspaceId = readWorkspaceId(headers)
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }

    const sql = getSql()
    const filters = buildFilters(workspaceId, query)
    const zoom = query.zoom ?? 12
    const clusterMode = query.cluster ?? 'auto'
    const precision = clusterMode === 'false' ? null : geohashPrecisionForZoom(Number(zoom))

    const latitude = latitudeFromBbox(filters.bbox)
    const numericZoom = Number(zoom)

    // Group visually overlapping dots when clustering is disabled or zoom is high enough.
    if (precision === null || clusterMode === 'false') {
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
    query: t.Object({
      bbox: t.Optional(t.String()),
      radius: t.Optional(t.String()),
      polygon: t.Optional(t.String()),
      zoom: t.Optional(t.Number()),
      q: t.Optional(t.String()),
      filter: t.Optional(t.String()),
      jsonpath: t.Optional(t.String()),
      cluster: t.Optional(t.String()),
    }),
  },
)
