import type {Bbox, RadiusFilter} from '@doors/api/schemas'

import type {MapPeopleFilters} from '../db/geo/mapFilters'

/** Parsed map/stats query params shared by map and stats routes. */
export type MapQueryParams = {
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
 * Parses comma-separated bbox query param into numeric bounds.
 * Returns undefined when the value is missing or not four finite numbers.
 */
export function parseBbox(raw: string | undefined): Bbox | undefined {
  if (!raw) {
    return undefined
  }

  const parts = raw.split(',').map(Number)
  const west = parts[0]
  const south = parts[1]
  const east = parts[2]
  const north = parts[3]

  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return undefined
  }

  return {west, south, east, north}
}

/**
 * Parses comma-separated radius query param into center + meters.
 * Returns undefined when the value is missing or not three finite numbers.
 */
export function parseRadius(raw: string | undefined): RadiusFilter | undefined {
  if (!raw) {
    return undefined
  }

  const parts = raw.split(',').map(Number)
  const lng = parts[0]
  const lat = parts[1]
  const meters = parts[2]

  if (
    lng === undefined ||
    lat === undefined ||
    meters === undefined ||
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(meters)
  ) {
    return undefined
  }

  return {lng, lat, meters}
}

/**
 * Parses filter=location_type=venue style query param.
 */
export function parseLocationTypeFilter(raw: string | undefined): string | undefined {
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
export function buildMapPeopleFilters(
  workspaceId: string,
  query: MapQueryParams,
): MapPeopleFilters {
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
