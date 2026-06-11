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

/** GeoJSON Polygon ring (closed ring of lng/lat pairs). */
const geoJsonPolygonRingSchema = t.Array(t.Tuple([t.Number(), t.Number()]))

/** GeoJSON Polygon geometry for turf create/update bodies. */
export const geoJsonPolygonSchema = t.Object({
  type: t.Literal('Polygon'),
  coordinates: t.Array(geoJsonPolygonRingSchema),
})

/** GeoJSON Polygon type. */
export type GeoJsonPolygon = Static<typeof geoJsonPolygonSchema>

/** Generic GeoJSON feature for map overlays (turfs, drafts, etc.). */
export type GeoJsonFeature = {
  type: 'Feature'
  id?: string
  properties: Record<string, unknown>
  geometry: GeoJsonGeometry
}

/** Generic GeoJSON FeatureCollection for non-people map layers. */
export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}
