import {type Static, t} from 'elysia'

import {geoJsonGeometrySchema} from '../geo/geoJson'
import type {CreateLocationBody, UpdateLocationBody} from '../validators/location'

/** Location resource returned by CRUD endpoints. */
export const locationResourceSchema = t.Object({
  id: t.String(),
  workspaceId: t.String(),
  name: t.String(),
  address: t.String(),
  locationType: t.String(),
  geometry: geoJsonGeometrySchema,
  createdAt: t.String(),
  updatedAt: t.String(),
})

/** Location resource type. */
export type LocationResource = Static<typeof locationResourceSchema>

/** Alias for database row naming in repos. */
export type LocationRow = LocationResource

/** Input for creating a location. */
export type CreateLocationInput = {
  id?: string
  workspaceId: string
} & CreateLocationBody

/** Input for updating a location. */
export type UpdateLocationInput = UpdateLocationBody
