import {type Static, t} from 'elysia'

/** Person link row mapping a person to an external identity. */
export const personLinkSchema = t.Object({
  id: t.String(),
  workspaceId: t.String(),
  personId: t.String(),
  source: t.String(),
  externalId: t.String(),
  createdAt: t.String(),
})

/** Person link type. */
export type PersonLink = Static<typeof personLinkSchema>

/** Input for creating a person link. */
export type CreatePersonLinkInput = {
  id?: string
  workspaceId: string
  personId: string
  source: string
  externalId: string
}
