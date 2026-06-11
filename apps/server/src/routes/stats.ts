import {Elysia, t} from 'elysia'

import {getSql} from '../db/client'
import type {MapPeopleFilters} from '../db/geo/mapFilters'
import {metadataFieldKey} from '../db/geo/mapFilters'
import {queryPeopleHistogram} from '../db/repos/mapQueryRepo'
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
 * Converts $.occupation style paths to a jsonb object key.
 */
function parseMetadataField(field: string): string {
  return metadataFieldKey(field)
}

/**
 * Stats routes for aggregated people metadata.
 */
export const statsRoutes = new Elysia({prefix: '/stats'}).get(
  '/histogram',
  async ({headers, query, set}) => {
    const workspaceId = readWorkspaceId(headers)
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }

    const sql = getSql()
    const filters: MapPeopleFilters = {
      workspaceId,
      bbox: parseBbox(query.bbox),
      radius: parseRadius(query.radius),
      polygonGeoJson: query.polygon,
      locationType: parseLocationTypeFilter(query.filter),
      query: query.q,
      jsonPath: query.jsonpath,
    }

    // Group people by a metadata field value within optional geo filters.
    const buckets = await queryPeopleHistogram(sql, filters, parseMetadataField(query.field))

    return {
      field: query.field,
      buckets,
    }
  },
  {
    query: t.Object({
      field: t.String(),
      bbox: t.Optional(t.String()),
      radius: t.Optional(t.String()),
      polygon: t.Optional(t.String()),
      q: t.Optional(t.String()),
      filter: t.Optional(t.String()),
      jsonpath: t.Optional(t.String()),
    }),
  },
)
