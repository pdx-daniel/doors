import {type Static, t} from 'elysia'

import {geoJsonPolygonSchema} from '../geo/geoJson'

/** Request body for POST /v1/turfs. */
export const createTurfBodySchema = t.Object({
  name: t.Optional(t.String()),
  geometry: geoJsonPolygonSchema,
  color: t.Optional(t.String()),
})

/** Create turf request body type. */
export type CreateTurfBody = Static<typeof createTurfBodySchema>

/** Request body for PATCH /v1/turfs/:id. */
export const updateTurfBodySchema = t.Object({
  name: t.Optional(t.String()),
  geometry: t.Optional(geoJsonPolygonSchema),
  color: t.Optional(t.String()),
})

/** Update turf request body type. */
export type UpdateTurfBody = Static<typeof updateTurfBodySchema>
