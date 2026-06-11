import {type Static, t} from 'elysia'

/** Request body for POST /v1/people. */
export const createPersonBodySchema = t.Object({
  displayName: t.String(),
  email: t.Optional(t.String()),
  phone: t.Optional(t.String()),
  locationId: t.Optional(t.Union([t.String(), t.Null()])),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
})

/** Create person request body type. */
export type CreatePersonBody = Static<typeof createPersonBodySchema>

/** Request body for PATCH /v1/people/:id. */
export const updatePersonBodySchema = t.Object({
  displayName: t.Optional(t.String()),
  email: t.Optional(t.String()),
  phone: t.Optional(t.String()),
  locationId: t.Optional(t.Union([t.String(), t.Null()])),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
})

/** Update person request body type. */
export type UpdatePersonBody = Static<typeof updatePersonBodySchema>
