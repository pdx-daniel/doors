import {type Static, t} from 'elysia'

import type {CreatePersonBody, UpdatePersonBody} from '../validators/person'

/** Person resource returned by CRUD endpoints. */
export const personResourceSchema = t.Object({
  id: t.String(),
  workspaceId: t.String(),
  displayName: t.String(),
  email: t.String(),
  phone: t.String(),
  locationId: t.Union([t.String(), t.Null()]),
  metadata: t.Record(t.String(), t.Unknown()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

/** Person resource type. */
export type PersonResource = Static<typeof personResourceSchema>

/** Alias for database row naming in repos. */
export type PersonRow = PersonResource

/** Input for creating a person. */
export type CreatePersonInput = {
  id?: string
  workspaceId: string
} & CreatePersonBody

/** Input for updating a person. */
export type UpdatePersonInput = UpdatePersonBody
