import type {StyleSpecification} from 'maplibre-gl'

import darkStyle from '../assets/dark.style.json'
import libertyStyle from '../assets/liberty.style.json'
import type {MapAppearance} from '../constants/map'

/**
 * Builds an OpenMapTiles-compatible style that reads vector tiles from a PMTiles archive.
 * Sprites and glyphs continue to load from OpenFreeMap CDN assets bundled in the base style.
 */
export function buildBasemapStyle(
  pmtilesUrl: string,
  appearance: MapAppearance,
): StyleSpecification {
  // Pick the light or dark paint palette while sharing the same vector tile data.
  const baseStyle = appearance === 'dark' ? darkStyle : libertyStyle

  // Clone the committed base style and point the vector source at the local archive.
  const style = structuredClone(baseStyle) as StyleSpecification

  style.sources = {
    ...style.sources,
    openmaptiles: {
      type: 'vector',
      url: pmtilesUrl,
    },
  }

  return style
}
