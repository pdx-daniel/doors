import {type Static, t} from 'elysia'

/** Shared geo/text filter query fields for map and stats routes. */
export const mapFilterQuerySchema = t.Object({
  bbox: t.Optional(t.String()),
  radius: t.Optional(t.String()),
  polygon: t.Optional(t.String()),
  polygonMode: t.Optional(t.Union([t.Literal('union'), t.Literal('intersection')])),
  q: t.Optional(t.String()),
  filter: t.Optional(t.String()),
  jsonpath: t.Optional(t.String()),
})

/** Parsed map filter query params before workspace scoping. */
export type MapFilterQuery = Static<typeof mapFilterQuerySchema>
