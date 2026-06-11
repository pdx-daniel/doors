import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type {MapViewport} from '@doors/api/geo/mapPeople'
import type {ReactElement} from 'react'
import {useCallback, useEffect, useRef} from 'react'
import {StyleSheet, View} from 'react-native'

import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  getBasemapPmtilesUrl,
  getRemoteFallbackStyleUrl,
} from '@/constants/map'
import {useTurfContext} from '@/contexts/TurfContext'
import {useMapViewModel} from '@/hooks/useMapViewModel'
import {useTurfMapWeb} from '@/hooks/useTurfMapWeb'
import {buildBasemapStyle} from '@/lib/basemapStyle'
import {
  PEOPLE_CIRCLE_LAYER_ID,
  PEOPLE_COUNT_LAYER_ID,
  PEOPLE_SOURCE_ID,
  peopleCirclePaint,
  peopleCountFilter,
  peopleCountLayout,
  peopleCountPaint,
} from '@/lib/mapPeopleLayer'
import {registerPmtilesProtocol} from '@/lib/registerPmtilesProtocol'

/** Removes the people GeoJSON source and layers from a MapLibre map instance. */
function removePeopleLayer(map: maplibregl.Map): void {
  if (map.getLayer(PEOPLE_COUNT_LAYER_ID)) {
    map.removeLayer(PEOPLE_COUNT_LAYER_ID)
  }

  if (map.getLayer(PEOPLE_CIRCLE_LAYER_ID)) {
    map.removeLayer(PEOPLE_CIRCLE_LAYER_ID)
  }

  if (map.getSource(PEOPLE_SOURCE_ID)) {
    map.removeSource(PEOPLE_SOURCE_ID)
  }
}

/** Returns true when an error event likely indicates basemap tile/style load failure. */
function isBasemapLoadError(event: maplibregl.ErrorEvent): boolean {
  const sourceId = 'sourceId' in event && typeof event.sourceId === 'string' ? event.sourceId : ''
  const message = event.error?.message ?? ''

  return (
    sourceId.includes('openmaptiles') ||
    message.includes('pmtiles') ||
    message.includes('Failed to load') ||
    message.includes('404')
  )
}

/**
 * Web map renderer backed by maplibre-gl v5.
 * Loads local PMTiles when available and falls back to OpenFreeMap on failure.
 */
export function MapView(): ReactElement {
  const {appearance, setViewport, peopleData, peopleEnabled, onBasemapFailure, onPeoplePress} =
    useMapViewModel()
  const {turfActive} = useTurfContext()
  const appearanceRef = useRef(appearance)
  const previousAppearanceRef = useRef<string | null>(null)
  const hostRef = useRef<View>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const fallbackUsedRef = useRef(false)
  const peopleEnabledRef = useRef(peopleEnabled)
  const turfActiveRef = useRef(turfActive)

  appearanceRef.current = appearance
  peopleEnabledRef.current = peopleEnabled
  turfActiveRef.current = turfActive

  useTurfMapWeb(mapRef)

  const syncViewport = useCallback(
    (map: maplibregl.Map): void => {
      const bounds = map.getBounds()
      const west = bounds.getWest()
      const south = bounds.getSouth()
      const east = bounds.getEast()
      const north = bounds.getNorth()
      const zoom = map.getZoom()

      const nextViewport: MapViewport = {west, south, east, north, zoom}
      setViewport(nextViewport)
    },
    [setViewport],
  )

  const ensurePeopleLayer = useCallback(
    (map: maplibregl.Map): void => {
      const existingSource = map.getSource(PEOPLE_SOURCE_ID)

      if (!existingSource) {
        map.addSource(PEOPLE_SOURCE_ID, {
          type: 'geojson',
          data: peopleData,
        })
        map.addLayer({
          id: PEOPLE_CIRCLE_LAYER_ID,
          type: 'circle',
          source: PEOPLE_SOURCE_ID,
          paint: peopleCirclePaint,
        } as maplibregl.AddLayerObject)
        map.addLayer({
          id: PEOPLE_COUNT_LAYER_ID,
          type: 'symbol',
          source: PEOPLE_SOURCE_ID,
          filter: peopleCountFilter,
          layout: peopleCountLayout,
          paint: peopleCountPaint,
        } as maplibregl.AddLayerObject)
        return
      }

      const source = existingSource as maplibregl.GeoJSONSource
      source.setData(peopleData)
    },
    [peopleData],
  )

  const ensurePeopleLayerRef = useRef(ensurePeopleLayer)
  ensurePeopleLayerRef.current = ensurePeopleLayer

  useEffect(() => {
    const hostElement = hostRef.current as unknown as HTMLDivElement | null
    if (!hostElement || mapRef.current) {
      return
    }

    registerPmtilesProtocol()

    const basemapStyle = buildBasemapStyle(getBasemapPmtilesUrl(), appearanceRef.current)

    const map = new maplibregl.Map({
      container: hostElement,
      style: basemapStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })

    mapRef.current = map

    map.on('error', (event: maplibregl.ErrorEvent) => {
      if (fallbackUsedRef.current || !isBasemapLoadError(event)) {
        return
      }

      fallbackUsedRef.current = true
      onBasemapFailure()
      map.setStyle(getRemoteFallbackStyleUrl(appearanceRef.current))
    })

    map.once('load', () => {
      map.resize()
      syncViewport(map)
      previousAppearanceRef.current = appearanceRef.current

      if (peopleEnabledRef.current) {
        ensurePeopleLayerRef.current(map)
      }
    })

    map.on('moveend', () => {
      syncViewport(map)
    })

    map.on('click', event => {
      if (turfActiveRef.current) {
        return
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: [PEOPLE_CIRCLE_LAYER_ID, PEOPLE_COUNT_LAYER_ID],
      })
      const circleFeature = features.find(feature => feature.layer?.id === PEOPLE_CIRCLE_LAYER_ID)
      const feature = circleFeature ?? features[0]

      if (feature?.properties) {
        onPeoplePress(feature.properties)
      }
    })

    map.on('mouseenter', PEOPLE_CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', PEOPLE_CIRCLE_LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
    })

    return (): void => {
      map.remove()
      mapRef.current = null
    }
  }, [onBasemapFailure, onPeoplePress, syncViewport])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) {
      return
    }

    if (previousAppearanceRef.current === appearance) {
      return
    }

    const hadPreviousAppearance = previousAppearanceRef.current !== null
    previousAppearanceRef.current = appearance

    if (!hadPreviousAppearance) {
      return
    }

    const nextStyle = fallbackUsedRef.current
      ? getRemoteFallbackStyleUrl(appearance)
      : buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
    map.setStyle(nextStyle)

    map.once('load', () => {
      syncViewport(map)

      if (peopleEnabledRef.current) {
        ensurePeopleLayerRef.current(map)
      }
    })
  }, [appearance, syncViewport])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) {
      return
    }

    if (!peopleEnabled) {
      removePeopleLayer(map)
      return
    }

    ensurePeopleLayer(map)
  }, [ensurePeopleLayer, peopleEnabled])

  return <View ref={hostRef} style={styles.map} />
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
})
