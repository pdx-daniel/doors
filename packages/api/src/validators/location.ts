import {type Static, t} from 'elysia'

import {geoJsonGeometrySchema} from '../geo/geoJson'

/** GeoJSON geometry validator for location bodies. */
export const geometrySchema = geoJsonGeometrySchema

/** Request body for POST /v1/locations. */
export const createLocationBodySchema = t.Object({
  name: t.String(),
  address: t.Optional(t.String()),
  locationType: t.Optional(t.String()),
  geometry: geometrySchema,
})

/** Create location request body type. */
export type CreateLocationBody = Static<typeof createLocationBodySchema>

/** Request body for PATCH /v1/locations/:id. */
export const updateLocationBodySchema = t.Object({
  name: t.Optional(t.String()),
  address: t.Optional(t.String()),
  locationType: t.Optional(t.String()),
  geometry: t.Optional(geometrySchema),
})

/** Update location request body type. */
export type UpdateLocationBody = Static<typeof updateLocationBodySchema>

/** Query params for GET /v1/locations. */
export const listLocationsQuerySchema = t.Object({
  bbox: t.Optional(t.String()),
})

/** List locations query type. */
export type ListLocationsQuery = Static<typeof listLocationsQuerySchema>
