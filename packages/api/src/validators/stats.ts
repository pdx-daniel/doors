import {type Static, t} from 'elysia'

import {mapFilterQuerySchema} from './mapQuery'

/** Query params for GET /v1/stats/histogram. */
export const histogramQuerySchema = t.Composite([
  mapFilterQuerySchema,
  t.Object({
    field: t.String(),
  }),
])

/** Histogram query type. */
export type HistogramQuery = Static<typeof histogramQuerySchema>
