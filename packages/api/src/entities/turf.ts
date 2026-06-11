import {type Static, t} from 'elysia'

import {geoJsonGeometrySchema} from '../geo/geoJson'
import type {CreateTurfBody, UpdateTurfBody} from '../validators/turf'

/** Turf resource returned by CRUD endpoints (geometry from linked location). */
export const turfResourceSchema = t.Object({
  id: t.String(),
  workspaceId: t.String(),
  locationId: t.String(),
  name: t.String(),
  color: t.String(),
  geometry: geoJsonGeometrySchema,
  metadata: t.Record(t.String(), t.Unknown()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

/** Turf resource type. */
export type TurfResource = Static<typeof turfResourceSchema>

/** Alias for database row naming in repos. */
export type TurfRow = TurfResource

/** Input for creating a turf with linked polygon location. */
export type CreateTurfInput = {
  id?: string
  workspaceId: string
} & CreateTurfBody

/** Input for updating a turf and optional linked location fields. */
export type UpdateTurfInput = UpdateTurfBody
