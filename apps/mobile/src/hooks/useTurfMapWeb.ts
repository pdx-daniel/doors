import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

import type {GeoJsonPolygon} from '@doors/api/geo/geoJson'
import type maplibregl from 'maplibre-gl'
import type {RefObject} from 'react'
import {useEffect, useRef} from 'react'

import {useTurfContext} from '@/contexts/TurfContext'
import {useTurfMapLayerData} from '@/hooks/useTurfMapLayerData'
import {
  getDraftVertexIndexFromFeatures,
  isClickNearMapPoint,
  MIN_TURF_VERTICES,
} from '@/lib/turfGeoJson'
import {
  asMapLibreGeoJson,
  TURF_DRAFT_CLOSE_HIT_LAYER_ID,
  TURF_DRAFT_LINE_LAYER_ID,
  TURF_DRAFT_SOURCE_ID,
  TURF_DRAFT_VERTEX_LABEL_LAYER_ID,
  TURF_DRAFT_VERTEX_LAYER_ID,
  TURF_FILL_LAYER_ID,
  TURF_LINE_LAYER_ID,
  TURF_SOURCE_ID,
  turfDraftCloseHitPaint,
  turfDraftLinePaint,
  turfDraftVertexLabelLayout,
  turfDraftVertexLabelPaint,
  turfDraftVertexPaint,
  turfFillPaint,
  turfLinePaint,
} from '@/lib/turfMapLayers'

/** Removes turf GeoJSON sources and layers from the map. */
function removeTurfLayers(map: maplibregl.Map): void {
  for (const layerId of [
    TURF_DRAFT_VERTEX_LABEL_LAYER_ID,
    TURF_DRAFT_CLOSE_HIT_LAYER_ID,
    TURF_DRAFT_VERTEX_LAYER_ID,
    TURF_DRAFT_LINE_LAYER_ID,
    TURF_FILL_LAYER_ID,
    TURF_LINE_LAYER_ID,
  ]) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId)
    }
  }

  for (const sourceId of [TURF_DRAFT_SOURCE_ID, TURF_SOURCE_ID]) {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId)
    }
  }
}

/** Ensures turf fill/line layers exist and updates their data. */
function syncTurfLayers(
  map: maplibregl.Map,
  turfData: ReturnType<typeof useTurfMapLayerData>['turfData'],
  draftData: ReturnType<typeof useTurfMapLayerData>['draftData'],
): void {
  if (!map.getSource(TURF_SOURCE_ID)) {
    map.addSource(TURF_SOURCE_ID, {type: 'geojson', data: asMapLibreGeoJson(turfData)})
    map.addLayer({
      id: TURF_FILL_LAYER_ID,
      type: 'fill',
      source: TURF_SOURCE_ID,
      paint: turfFillPaint,
    } as maplibregl.AddLayerObject)
    map.addLayer({
      id: TURF_LINE_LAYER_ID,
      type: 'line',
      source: TURF_SOURCE_ID,
      paint: turfLinePaint,
    } as maplibregl.AddLayerObject)
  } else {
    ;(map.getSource(TURF_SOURCE_ID) as maplibregl.GeoJSONSource).setData(
      asMapLibreGeoJson(turfData),
    )
  }

  if (!map.getSource(TURF_DRAFT_SOURCE_ID)) {
    map.addSource(TURF_DRAFT_SOURCE_ID, {type: 'geojson', data: asMapLibreGeoJson(draftData)})
    map.addLayer({
      id: TURF_DRAFT_LINE_LAYER_ID,
      type: 'line',
      source: TURF_DRAFT_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: turfDraftLinePaint,
    } as maplibregl.AddLayerObject)
    map.addLayer({
      id: TURF_DRAFT_VERTEX_LAYER_ID,
      type: 'circle',
      source: TURF_DRAFT_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: turfDraftVertexPaint,
    } as maplibregl.AddLayerObject)
    map.addLayer({
      id: TURF_DRAFT_CLOSE_HIT_LAYER_ID,
      type: 'circle',
      source: TURF_DRAFT_SOURCE_ID,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['get', 'isCloseTarget']],
      paint: turfDraftCloseHitPaint,
    } as maplibregl.AddLayerObject)
    map.addLayer({
      id: TURF_DRAFT_VERTEX_LABEL_LAYER_ID,
      type: 'symbol',
      source: TURF_DRAFT_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: turfDraftVertexLabelLayout,
      paint: turfDraftVertexLabelPaint,
    } as maplibregl.AddLayerObject)
  } else {
    ;(map.getSource(TURF_DRAFT_SOURCE_ID) as maplibregl.GeoJSONSource).setData(
      asMapLibreGeoJson(draftData),
    )
  }
}

/**
 * Wires turf draw/select/edit interactions into a maplibre-gl map instance (web).
 */
export function useTurfMapWeb(mapRef: RefObject<maplibregl.Map | null>): void {
  const {turfActive, turfData, draftData} = useTurfMapLayerData()
  const turfContext = useTurfContext()
  const drawRef = useRef<MapboxDraw | null>(null)
  const editFeatureIdRef = useRef<string | null>(null)

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !turfActive) {
      return
    }

    syncTurfLayers(map, turfData, draftData)
  }, [draftData, mapRef, turfActive, turfData])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !turfActive) {
      if (map && drawRef.current) {
        map.removeControl(drawRef.current as unknown as maplibregl.IControl)
        drawRef.current = null
      }

      return
    }

    if (!drawRef.current) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: 'simple_select',
      })
      map.addControl(draw as unknown as maplibregl.IControl)
      drawRef.current = draw

      map.on('draw.update', () => {
        const draw = drawRef.current
        const editingId = editFeatureIdRef.current
        if (!draw || !editingId) {
          return
        }

        const feature = draw.get(editingId)
        if (feature?.geometry.type === 'Polygon') {
          void turfContext.updateEditingGeometry(feature.geometry as GeoJsonPolygon)
        }
      })
    }

    return (): void => {
      if (drawRef.current && map) {
        map.removeControl(drawRef.current as unknown as maplibregl.IControl)
        drawRef.current = null
      }
    }
  }, [mapRef, turfActive, turfContext])

  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !turfActive) {
      return
    }

    if (turfContext.editingTurfId) {
      const turf = turfContext.turfs.find(entry => entry.id === turfContext.editingTurfId)
      if (!turf) {
        return
      }

      draw.deleteAll()
      const ids = draw.add({
        type: 'Feature',
        properties: {},
        geometry: turf.geometry as GeoJsonPolygon,
      })
      const featureId = ids[0]
      if (featureId) {
        editFeatureIdRef.current = featureId
        draw.changeMode('direct_select', {featureId})
      }

      return
    }

    editFeatureIdRef.current = null
    draw.deleteAll()
    draw.changeMode('simple_select')
  }, [mapRef, turfActive, turfContext.editingTurfId, turfContext.turfs])

  useEffect(() => {
    if (!turfActive) {
      const map = mapRef.current
      if (map?.isStyleLoaded()) {
        removeTurfLayers(map)
      }

      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || event.altKey) {
        turfContext.setPanModifierActive(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || !event.altKey) {
        turfContext.setPanModifierActive(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      turfContext.setPanModifierActive(false)
    }
  }, [mapRef, turfActive, turfContext])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !turfActive) {
      return
    }

    const handleClick = (event: maplibregl.MapMouseEvent): void => {
      if (turfContext.editingTurfId) {
        return
      }

      if (turfContext.toolMode === 'draw') {
        if (turfContext.panModifierActive) {
          return
        }

        const draftHits = map.queryRenderedFeatures(event.point, {
          layers: [
            TURF_DRAFT_CLOSE_HIT_LAYER_ID,
            TURF_DRAFT_VERTEX_LAYER_ID,
            TURF_DRAFT_VERTEX_LABEL_LAYER_ID,
          ],
        })
        const hitVertexIndex = getDraftVertexIndexFromFeatures(draftHits)
        const firstVertex = turfContext.draftVertices[0]
        const canClose = turfContext.draftVertices.length >= MIN_TURF_VERTICES

        if (
          canClose &&
          (hitVertexIndex === 0 ||
            (firstVertex !== undefined && isClickNearMapPoint(map, firstVertex, event.point)))
        ) {
          void turfContext.completeDraftDraw()
          return
        }

        if (hitVertexIndex !== null) {
          return
        }

        void turfContext.addDraftVertex([event.lngLat.lng, event.lngLat.lat])
        return
      }

      const features = map.queryRenderedFeatures(event.point, {
        layers: [TURF_FILL_LAYER_ID, TURF_LINE_LAYER_ID],
      })
      const turfFeature = features[0]
      const turfId = turfFeature?.properties?.turfId

      if (typeof turfId === 'string') {
        turfContext.toggleSelectTurf(turfId)
        return
      }

      turfContext.clearSelection()
    }

    const handleContextMenu = (event: maplibregl.MapMouseEvent): void => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [TURF_FILL_LAYER_ID, TURF_LINE_LAYER_ID],
      })
      const turfFeature = features[0]
      const turfId = turfFeature?.properties?.turfId

      if (typeof turfId === 'string') {
        event.preventDefault()
        turfContext.requestDeleteTurf(turfId)
      }
    }

    map.on('click', handleClick)
    map.on('contextmenu', handleContextMenu)

    return (): void => {
      map.off('click', handleClick)
      map.off('contextmenu', handleContextMenu)
    }
  }, [mapRef, turfActive, turfContext])
}
