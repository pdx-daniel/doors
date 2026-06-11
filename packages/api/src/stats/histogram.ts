import {type Static, t} from 'elysia'

/** Histogram bucket returned by stats endpoints. */
export const histogramBucketSchema = t.Object({
  value: t.String(),
  count: t.Number(),
})

/** Histogram bucket type. */
export type HistogramBucket = Static<typeof histogramBucketSchema>

/** Histogram response payload. */
export const histogramResponseSchema = t.Object({
  field: t.String(),
  buckets: t.Array(histogramBucketSchema),
})

/** Histogram response type. */
export type HistogramResponse = Static<typeof histogramResponseSchema>
