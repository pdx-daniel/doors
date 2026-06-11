import {type Static, t} from 'elysia'

import {bboxSchema} from './bbox'
import {geoJsonPointSchema} from './geoJson'

/** GeoJSON Feature properties for clustered map points. */
export const mapClusterPropertiesSchema = t.Object({
  cluster: t.Literal(true),
  stacked: t.Literal(false),
  count: t.Number(),
  geohash: t.String(),
})

/** Cluster feature properties type. */
export type MapClusterProperties = Static<typeof mapClusterPropertiesSchema>

/** GeoJSON Feature properties for individual person map points. */
export const mapPersonPropertiesSchema = t.Object({
  cluster: t.Literal(false),
  stacked: t.Boolean(),
  count: t.Number(),
  personId: t.String(),
  displayName: t.String(),
  email: t.String(),
  phone: t.String(),
  locationId: t.String(),
  locationName: t.String(),
  locationType: t.String(),
  metadata: t.Record(t.String(), t.Unknown()),
})

/** Individual person feature properties type. */
export type MapPersonProperties = Static<typeof mapPersonPropertiesSchema>

/** GeoJSON Feature on the people map layer. */
export const mapPeopleFeatureSchema = t.Object({
  type: t.Literal('Feature'),
  geometry: geoJsonPointSchema,
  properties: t.Union([mapClusterPropertiesSchema, mapPersonPropertiesSchema]),
})

/** People map feature type. */
export type MapPeopleFeature = Static<typeof mapPeopleFeatureSchema>

/** GeoJSON FeatureCollection returned by GET /v1/map/people. */
export const geoJsonFeatureCollectionSchema = t.Object({
  type: t.Literal('FeatureCollection'),
  features: t.Array(mapPeopleFeatureSchema),
})

/** People map FeatureCollection type. */
export type GeoJsonFeatureCollection = Static<typeof geoJsonFeatureCollectionSchema>

/** Map viewport bounds sent from the client. */
export const mapViewportSchema = t.Composite([
  bboxSchema,
  t.Object({
    zoom: t.Number(),
  }),
])

/** Map viewport type. */
export type MapViewport = Static<typeof mapViewportSchema>
