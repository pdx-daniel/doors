/** Histogram bucket returned by stats endpoints. */
export type HistogramBucket = {
  value: string
  count: number
}

/** Histogram response payload. */
export type HistogramResponse = {
  field: string
  buckets: HistogramBucket[]
}

/** Bounding box in WGS84 decimal degrees. */
export type Bbox = {
  west: number
  south: number
  east: number
  north: number
}

/** Radius filter centered on a WGS84 point. */
export type RadiusFilter = {
  lng: number
  lat: number
  meters: number
}

/** GeoJSON Point geometry. */
export type GeoJsonPoint = {
  type: 'Point'
  coordinates: [number, number]
}

/** GeoJSON geometry accepted by location APIs. */
export type GeoJsonGeometry = {
  type: string
  coordinates: unknown
}

/** GeoJSON Feature properties for clustered map points. */
export type MapClusterProperties = {
  cluster: true
  stacked: false
  count: number
  geohash: string
}

/** GeoJSON Feature properties for individual person map points. */
export type MapPersonProperties = {
  cluster: false
  stacked: boolean
  count: number
  personId: string
  displayName: string
  email: string
  phone: string
  locationId: string
  locationName: string
  locationType: string
  metadata: Record<string, unknown>
}

/** GeoJSON Feature on the people map layer. */
export type MapPeopleFeature = {
  type: 'Feature'
  geometry: GeoJsonPoint
  properties: MapClusterProperties | MapPersonProperties
}

/** GeoJSON FeatureCollection returned by GET /v1/map/people. */
export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: MapPeopleFeature[]
}

/** Location resource returned by CRUD endpoints. */
export type LocationResource = {
  id: string
  workspaceId: string
  name: string
  address: string
  locationType: string
  geometry: GeoJsonGeometry
  createdAt: string
  updatedAt: string
}

/** Person resource returned by CRUD endpoints. */
export type PersonResource = {
  id: string
  workspaceId: string
  displayName: string
  email: string
  phone: string
  locationId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** Map viewport bounds sent from the client. */
export type MapViewport = Bbox & {
  zoom: number
}
