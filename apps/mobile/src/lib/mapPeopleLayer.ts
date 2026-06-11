import type {GeoJsonFeatureCollection} from '@doors/api/schemas'
import type {
  CircleLayerSpecification,
  FilterSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'

/** MapLibre source id for the people GeoJSON layer. */
export const PEOPLE_SOURCE_ID = 'doors-people'

/** MapLibre circle layer id for people dots and clusters. */
export const PEOPLE_CIRCLE_LAYER_ID = 'doors-people-circles'

/** MapLibre symbol layer id for count labels on stacks and clusters. */
export const PEOPLE_COUNT_LAYER_ID = 'doors-people-counts'

/** Fill color for individual person dots. */
export const PEOPLE_DOT_COLOR = '#2563eb'

/** Fill color for low-zoom cluster bubbles. */
export const PEOPLE_CLUSTER_COLOR = '#1d4ed8'

/** Fill color for co-located stacks at high zoom. */
export const PEOPLE_STACK_COLOR = '#1e40af'

/** Minimum circle radius in pixels for person dots. */
export const PEOPLE_DOT_RADIUS = 6

/** Maximum circle radius in pixels for cluster bubbles. */
export const PEOPLE_CLUSTER_MAX_RADIUS = 28

/** Empty GeoJSON collection used before the first successful fetch. */
export const EMPTY_FEATURE_COLLECTION: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

type PeopleCirclePaint = NonNullable<CircleLayerSpecification['paint']>
type PeopleCountLayout = NonNullable<SymbolLayerSpecification['layout']>
type PeopleCountPaint = NonNullable<SymbolLayerSpecification['paint']>

/** Shared circle paint for people dots, stacks, and geohash clusters. */
export const peopleCirclePaint: PeopleCirclePaint = {
  'circle-radius': [
    'case',
    ['==', ['get', 'cluster'], true],
    ['interpolate', ['linear'], ['get', 'count'], 1, 12, 100, PEOPLE_CLUSTER_MAX_RADIUS],
    ['>', ['get', 'count'], 1],
    ['interpolate', ['linear'], ['get', 'count'], 2, 10, 20, 22],
    PEOPLE_DOT_RADIUS,
  ],
  'circle-color': [
    'case',
    ['==', ['get', 'cluster'], true],
    PEOPLE_CLUSTER_COLOR,
    ['==', ['get', 'stacked'], true],
    PEOPLE_STACK_COLOR,
    PEOPLE_DOT_COLOR,
  ],
  'circle-stroke-width': 1,
  'circle-stroke-color': '#ffffff',
}

/** Shared symbol layout for numeric count badges. */
export const peopleCountLayout: PeopleCountLayout = {
  'text-field': ['to-string', ['get', 'count']],
  'text-size': 11,
  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
  'text-allow-overlap': true,
  'text-ignore-placement': true,
}

/** Shared symbol paint for numeric count badges. */
export const peopleCountPaint: PeopleCountPaint = {
  'text-color': '#ffffff',
}

/** Filter expression showing counts only when more than one person share a dot. */
export const peopleCountFilter: FilterSpecification = ['>', ['get', 'count'], 1]
