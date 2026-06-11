import {type Static, t} from 'elysia'

import {mapFilterQuerySchema} from './mapQuery'

/** Query params for GET /v1/map/people. */
export const mapPeopleQuerySchema = t.Composite([
  mapFilterQuerySchema,
  t.Object({
    zoom: t.Optional(t.Number()),
    cluster: t.Optional(t.String()),
  }),
])

/** Map people query type. */
export type MapPeopleQuery = Static<typeof mapPeopleQuerySchema>
