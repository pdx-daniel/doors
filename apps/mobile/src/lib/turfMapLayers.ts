import type {GeoJsonFeatureCollection} from '@doors/api/geo/geoJson'
import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'

/** GeoJSON source id for persisted turf polygons. */
export const TURF_SOURCE_ID = 'doors-turfs'

/** Fill layer for turf polygons. */
export const TURF_FILL_LAYER_ID = 'doors-turfs-fill'

/** Outline layer for turf polygons. */
export const TURF_LINE_LAYER_ID = 'doors-turfs-line'

/** GeoJSON source id for in-progress draw preview. */
export const TURF_DRAFT_SOURCE_ID = 'doors-turf-draft'

/** Line layer for draft polygon edges. */
export const TURF_DRAFT_LINE_LAYER_ID = 'doors-turf-draft-line'

/** Circle layer for draft vertex handles. */
export const TURF_DRAFT_VERTEX_LAYER_ID = 'doors-turf-draft-vertices'

/** Symbol layer for draft vertex order labels. */
export const TURF_DRAFT_VERTEX_LABEL_LAYER_ID = 'doors-turf-draft-vertex-labels'

/** Invisible enlarged hit target for the close (first) vertex. */
export const TURF_DRAFT_CLOSE_HIT_LAYER_ID = 'doors-turf-draft-close-hit'

type TurfFillPaint = NonNullable<FillLayerSpecification['paint']>
type TurfLinePaint = NonNullable<LineLayerSpecification['paint']>
type TurfDraftVertexPaint = NonNullable<CircleLayerSpecification['paint']>
type TurfDraftVertexLabelLayout = NonNullable<SymbolLayerSpecification['layout']>
type TurfDraftVertexLabelPaint = NonNullable<SymbolLayerSpecification['paint']>

/** Fill paint for turf polygons (color from feature properties). */
export const turfFillPaint: TurfFillPaint = {
  'fill-color': ['get', 'color'],
  'fill-opacity': ['case', ['get', 'selected'], 0.45, 0.25],
}

/** Line paint for turf polygon outlines. */
export const turfLinePaint: TurfLinePaint = {
  'line-color': ['get', 'color'],
  'line-width': ['case', ['get', 'selected'], 3, 1.5],
}

/** Paint for draft vertex points; first vertex enlarges when it can close the ring. */
export const turfDraftVertexPaint: TurfDraftVertexPaint = {
  'circle-radius': ['case', ['get', 'isCloseTarget'], 12, 8],
  'circle-color': '#ffffff',
  'circle-stroke-color': ['case', ['get', 'isCloseTarget'], '#10B981', '#3B82F6'],
  'circle-stroke-width': ['case', ['get', 'isCloseTarget'], 3, 2],
}

/** Invisible enlarged circle for easier first-vertex close clicks. */
export const turfDraftCloseHitPaint: TurfDraftVertexPaint = {
  'circle-radius': 24,
  'circle-color': '#10B981',
  'circle-opacity': 0.001,
  'circle-stroke-width': 0,
}

/** Layout for 1-based vertex order labels while drawing. */
export const turfDraftVertexLabelLayout: TurfDraftVertexLabelLayout = {
  'text-field': ['to-string', ['get', 'vertexNumber']],
  'text-size': 11,
  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
  'text-allow-overlap': true,
  'text-ignore-placement': true,
}

/** Paint for draft vertex order labels. */
export const turfDraftVertexLabelPaint: TurfDraftVertexLabelPaint = {
  'text-color': '#1e3a8a',
}

/** Paint for draft line preview. */
export const turfDraftLinePaint: TurfLinePaint = {
  'line-color': '#3B82F6',
  'line-width': 2,
  'line-dasharray': [2, 1],
}

/** Casts turf GeoJSON into MapLibre-compatible data for sources. */
export function asMapLibreGeoJson(collection: GeoJsonFeatureCollection): GeoJSON.FeatureCollection {
  return collection as unknown as GeoJSON.FeatureCollection
}
