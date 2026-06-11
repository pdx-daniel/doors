import type {StyleSpecification} from 'maplibre-gl'

import baseStyle from '../assets/liberty.style.json'

/**
 * Builds an OpenMapTiles-compatible Liberty style that reads vector tiles from a PMTiles archive.
 * Sprites and glyphs continue to load from OpenFreeMap CDN assets bundled in the base style.
 */
export function buildBasemapStyle(pmtilesUrl: string): StyleSpecification {
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
