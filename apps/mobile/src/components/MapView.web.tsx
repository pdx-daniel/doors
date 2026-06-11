import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type {ReactElement} from 'react'
import {useEffect, useRef} from 'react'
import {StyleSheet, View} from 'react-native'

import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  getBasemapPmtilesUrl,
  getRemoteFallbackStyleUrl,
} from '../constants/map'
import {useMapAppearance} from '../hooks/useMapAppearance'
import {buildBasemapStyle} from '../lib/basemapStyle'
import {registerPmtilesProtocol} from '../lib/registerPmtilesProtocol'

/**
 * Web map renderer backed by maplibre-gl v5.
 * Loads local PMTiles when available and falls back to OpenFreeMap on failure.
 */
export function MapView(): ReactElement {
  const appearance = useMapAppearance()
  const appearanceRef = useRef(appearance)
  const hostRef = useRef<View>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const fallbackUsedRef = useRef(false)

  // Keep the error handler aligned with the latest system appearance.
  appearanceRef.current = appearance

  useEffect(() => {
    // RN-web exposes the underlying DOM element through the View ref.
    const hostElement = hostRef.current as unknown as HTMLDivElement | null
    if (!hostElement || mapRef.current) {
      return
    }

    // Enable pmtiles:// sources before constructing the map instance.
    registerPmtilesProtocol()

    // Build a local style that points at the dev-server PMTiles archive.
    const basemapStyle = buildBasemapStyle(getBasemapPmtilesUrl(), appearanceRef.current)

    // Create the MapLibre instance against the host DOM node.
    const map = new maplibregl.Map({
      container: hostElement,
      style: basemapStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })

    mapRef.current = map

    // Fall back to the remote OpenFreeMap style when local tiles or style assets fail.
    map.on('error', () => {
      if (fallbackUsedRef.current) {
        return
      }

      fallbackUsedRef.current = true
      map.setStyle(getRemoteFallbackStyleUrl(appearanceRef.current))
    })

    // Resize once tiles load in case layout settled after first paint.
    map.once('load', () => {
      map.resize()
    })

    return (): void => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    // Swap between light and dark palettes when the system appearance changes.
    const nextStyle = fallbackUsedRef.current
      ? getRemoteFallbackStyleUrl(appearance)
      : buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
    map.setStyle(nextStyle)
  }, [appearance])

  return <View ref={hostRef} style={styles.map} />
}

/** Layout for a map that fills all space offered by its parent. */
const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
})
