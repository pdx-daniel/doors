import {Platform} from 'react-native'

/** OpenFreeMap Liberty vector style used when local PMTiles are unavailable. */
export const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** HTTP path to the local PMTiles basemap served from the web app public folder. */
export const PMTILES_PATH = '/basemaps/basemap.pmtiles'

/**
 * Webpack dev server origin used by native simulators in phase 1.
 * Phase 2: bundle basemap.pmtiles as a device asset and return a file:// URL instead.
 */
export const WEB_DEV_SERVER_ORIGIN = 'http://localhost:3001'

/** Default map center — Portland, OR (MapLibre order: longitude, latitude). */
export const DEFAULT_CENTER: [number, number] = [-122.677379, 45.523461]

/** Default zoom level for the initial camera. */
export const DEFAULT_ZOOM = 12

/** Required map data attribution for OpenMapTiles-derived styles. */
export const MAP_ATTRIBUTION = '© OpenMapTiles © OpenStreetMap contributors'

/**
 * Returns the plain HTTP URL to the local PMTiles basemap (no pmtiles:// prefix).
 * Web uses the current page origin; native phase 1 uses the webpack dev server on the host.
 */
export function getPmtilesHttpUrl(): string {
  // Web bundles read tiles from the same origin that serves the app.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${PMTILES_PATH}`
  }

  // Simulator loads tiles from the host machine webpack dev server.
  return `${WEB_DEV_SERVER_ORIGIN}${PMTILES_PATH}`
}

/**
 * Returns the pmtiles:// URL used as the openmaptiles vector source in map styles.
 */
export function getBasemapPmtilesUrl(): string {
  return `pmtiles://${getPmtilesHttpUrl()}`
}
