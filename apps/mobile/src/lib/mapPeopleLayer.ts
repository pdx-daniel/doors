/** MapLibre source id for the people GeoJSON layer. */
export const PEOPLE_SOURCE_ID = 'doors-people'

/** MapLibre circle layer id for people dots and clusters. */
export const PEOPLE_CIRCLE_LAYER_ID = 'doors-people-circles'

/** Fill color for individual person dots. */
export const PEOPLE_DOT_COLOR = '#2563eb'

/** Fill color for low-zoom cluster bubbles. */
export const PEOPLE_CLUSTER_COLOR = '#1d4ed8'

/** Minimum circle radius in pixels for person dots. */
export const PEOPLE_DOT_RADIUS = 6

/** Maximum circle radius in pixels for cluster bubbles. */
export const PEOPLE_CLUSTER_MAX_RADIUS = 28

/** Empty GeoJSON collection used before the first successful fetch. */
export const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
} as const
