import {type Static, t} from 'elysia'

/** Bounding box in WGS84 decimal degrees. */
export const bboxSchema = t.Object({
  west: t.Number(),
  south: t.Number(),
  east: t.Number(),
  north: t.Number(),
})

/** Parsed bounding box type. */
export type Bbox = Static<typeof bboxSchema>

/** Radius filter centered on a WGS84 point. */
export const radiusFilterSchema = t.Object({
  lng: t.Number(),
  lat: t.Number(),
  meters: t.Number(),
})

/** Parsed radius filter type. */
export type RadiusFilter = Static<typeof radiusFilterSchema>
