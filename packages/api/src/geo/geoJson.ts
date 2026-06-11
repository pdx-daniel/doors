import {type Static, t} from 'elysia'

/** GeoJSON geometry accepted by location APIs. */
export const geoJsonGeometrySchema = t.Object({
  type: t.String(),
  coordinates: t.Unknown(),
})

/** GeoJSON geometry type. */
export type GeoJsonGeometry = Static<typeof geoJsonGeometrySchema>

/** GeoJSON Point geometry. */
export const geoJsonPointSchema = t.Object({
  type: t.Literal('Point'),
  coordinates: t.Tuple([t.Number(), t.Number()]),
})

/** GeoJSON Point type. */
export type GeoJsonPoint = Static<typeof geoJsonPointSchema>
