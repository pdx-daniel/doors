import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

import type {GeoJsonPolygon} from '@doors/api/geo/geoJson'
import type maplibregl from 'maplibre-gl'
import type {RefObject} from 'react'
import {useCallback, useEffect, useRef} from 'react'

import {useTurfContext} from '@/contexts/TurfContext'
import {useTurfMapLayerData} from '@/hooks/useTurfMapLayerData'
import {mapboxDrawStyles} from '@/lib/mapboxDrawStyles'
import {
  findNearestVertexIndex,
  getDraftVertexIndexFromFeatures,
  getPolygonExteriorVertices,
  isClickNearMapPoint,
  MIN_TURF_VERTICES,
  removePolygonVertex,
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

/** Layer ids for draft vertex handles that must render above polygon fills. */
const DRAFT_VERTEX_LAYER_IDS = [
  TURF_DRAFT_VERTEX_LABEL_LAYER_ID,
  TURF_DRAFT_CLOSE_HIT_LAYER_ID,
  TURF_DRAFT_VERTEX_LAYER_ID,
  TURF_DRAFT_LINE_LAYER_ID,
] as const

/** Moves draw handles and draft vertex layers above turf polygon fills. */
function raiseInteractiveLayers(map: maplibregl.Map): void {
  const styleLayers = map.getStyle()?.layers ?? []

  for (const layer of styleLayers) {
    if (
      layer.id.includes('gl-draw') &&
      (layer.id.includes('vertex') || layer.id.includes('midpoint') || layer.id.includes('point'))
    ) {
      if (map.getLayer(layer.id)) {
        map.moveLayer(layer.id)
      }
    }
  }

  for (const layerId of DRAFT_VERTEX_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId)
    }
  }
}

/** Starts direct_select for a turf polygon unless that session is already active. */
function startEditSession(
  map: maplibregl.Map,
  draw: MapboxDraw,
  editingTurfId: string,
  geometry: GeoJsonPolygon,
  editSessionIdRef: RefObject<string | null>,
  editFeatureIdRef: RefObject<string | null>,
): void {
  if (editSessionIdRef.current === editingTurfId && editFeatureIdRef.current !== null) {
    if (draw.getMode() !== 'direct_select') {
      draw.changeMode('direct_select', {featureId: editFeatureIdRef.current})
      raiseInteractiveLayers(map)
    }

    return
  }

  draw.deleteAll()
  const ids = draw.add({
    type: 'Feature',
    properties: {},
    geometry,
  })
  const featureId = ids[0]
  if (!featureId) {
    return
  }

  editSessionIdRef.current = editingTurfId
  editFeatureIdRef.current = featureId
  draw.changeMode('direct_select', {featureId})
  raiseInteractiveLayers(map)
}

/** Clears draw features and exits edit mode on the draw control. */
function clearEditSession(
  draw: MapboxDraw,
  editSessionIdRef: RefObject<string | null>,
  editFeatureIdRef: RefObject<string | null>,
): void {
  editSessionIdRef.current = null
  editFeatureIdRef.current = null
  draw.deleteAll()
  draw.changeMode('simple_select')
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

  raiseInteractiveLayers(map)
}

/**
 * Wires turf draw/select/edit interactions into a maplibre-gl map instance (web).
 */
export function useTurfMapWeb(mapRef: RefObject<maplibregl.Map | null>): void {
  const {turfActive, turfData, draftData} = useTurfMapLayerData()
  const turfContext = useTurfContext()
  const drawRef = useRef<MapboxDraw | null>(null)
  const editFeatureIdRef = useRef<string | null>(null)
  const editSessionIdRef = useRef<string | null>(null)
  const updateEditingGeometryRef = useRef(turfContext.updateEditingGeometry)
  const editingTurfIdRef = useRef(turfContext.editingTurfId)
  const editingGeometryRef = useRef(turfContext.editingGeometry)

  updateEditingGeometryRef.current = turfContext.updateEditingGeometry
  editingTurfIdRef.current = turfContext.editingTurfId
  editingGeometryRef.current = turfContext.editingGeometry

  const drawUpdateHandlerAttachedRef = useRef(false)

  const attachDrawUpdateHandler = useCallback((map: maplibregl.Map): void => {
    if (drawUpdateHandlerAttachedRef.current) {
      return
    }

    drawUpdateHandlerAttachedRef.current = true
    map.on('draw.update', () => {
      const draw = drawRef.current
      const editingId = editFeatureIdRef.current
      if (!draw || !editingId) {
        return
      }

      const feature = draw.get(editingId)
      if (feature?.geometry.type === 'Polygon') {
        void updateEditingGeometryRef.current(feature.geometry as GeoJsonPolygon)
      }
    })
  }, [])

  const ensureDrawControl = useCallback(
    (map: maplibregl.Map): MapboxDraw | null => {
      if (!map.isStyleLoaded()) {
        return null
      }

      if (!drawRef.current) {
        const draw = new MapboxDraw({
          displayControlsDefault: false,
          controls: {},
          defaultMode: 'simple_select',
          styles: mapboxDrawStyles as unknown as object[],
          clickBuffer: 4,
          touchBuffer: 28,
        })
        map.addControl(draw as unknown as maplibregl.IControl)
        drawRef.current = draw
        attachDrawUpdateHandler(map)
      }

      return drawRef.current
    },
    [attachDrawUpdateHandler],
  )

  const syncDrawEditSession = useCallback((): void => {
    const map = mapRef.current
    if (!map || !turfActive) {
      return
    }

    const draw = ensureDrawControl(map)
    if (!draw) {
      return
    }

    const editingTurfId = turfContext.editingTurfId
    if (!editingTurfId) {
      clearEditSession(draw, editSessionIdRef, editFeatureIdRef)
      return
    }

    const turf = turfContext.turfs.find(entry => entry.id === editingTurfId)
    const geometry = editingGeometryRef.current ?? (turf?.geometry as GeoJsonPolygon | undefined)
    if (!geometry) {
      return
    }

    startEditSession(map, draw, editingTurfId, geometry, editSessionIdRef, editFeatureIdRef)
  }, [ensureDrawControl, mapRef, turfActive, turfContext.editingTurfId, turfContext.turfs])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !turfActive) {
      return
    }

    const sync = (): void => {
      if (!map.isStyleLoaded()) {
        return
      }

      syncTurfLayers(map, turfData, draftData)
      syncDrawEditSession()
    }

    sync()
    map.on('load', sync)
    map.on('styledata', sync)

    return (): void => {
      map.off('load', sync)
      map.off('styledata', sync)
    }
  }, [draftData, mapRef, syncDrawEditSession, turfActive, turfData])

  useEffect(() => {
    if (turfActive) {
      syncDrawEditSession()
      return
    }

    const map = mapRef.current
    if (map && drawRef.current) {
      map.removeControl(drawRef.current as unknown as maplibregl.IControl)
      drawRef.current = null
      editFeatureIdRef.current = null
      editSessionIdRef.current = null
      drawUpdateHandlerAttachedRef.current = false
    }
  }, [mapRef, syncDrawEditSession, turfActive])

  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !turfActive) {
      return
    }

    const keepDirectSelect = (): void => {
      const featureId = editFeatureIdRef.current
      if (!editingTurfIdRef.current || !featureId) {
        return
      }

      if (draw.getMode() !== 'direct_select') {
        draw.changeMode('direct_select', {featureId})
        raiseInteractiveLayers(map)
      }
    }

    map.on('draw.modechange', keepDirectSelect)

    return (): void => {
      map.off('draw.modechange', keepDirectSelect)
    }
  }, [mapRef, turfActive])

  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !turfActive || !turfContext.editingTurfId) {
      return
    }

    const handleDoubleClick = (event: maplibregl.MapMouseEvent): void => {
      event.preventDefault()

      const featureId = editFeatureIdRef.current
      if (!featureId) {
        return
      }

      const feature = draw.get(featureId)
      if (feature?.geometry.type !== 'Polygon') {
        return
      }

      const polygon = feature.geometry as GeoJsonPolygon
      const vertices = getPolygonExteriorVertices(polygon)
      if (vertices.length <= MIN_TURF_VERTICES) {
        return
      }

      const drawHits = map.queryRenderedFeatures(event.point, {
        layers: (map.getStyle()?.layers ?? [])
          .map(layer => layer.id)
          .filter(
            id => id.includes('gl-draw') && id.includes('vertex') && !id.includes('midpoint'),
          ),
      })

      if (drawHits.length === 0) {
        return
      }

      const vertexIndex = findNearestVertexIndex(map, event.lngLat, vertices)
      if (vertexIndex === null) {
        return
      }

      const updated = removePolygonVertex(polygon, vertexIndex)
      if (!updated) {
        return
      }

      draw.delete(featureId)
      const newIds = draw.add({
        type: 'Feature',
        properties: {},
        geometry: updated,
      })
      const newFeatureId = newIds[0]
      if (!newFeatureId) {
        return
      }

      editFeatureIdRef.current = newFeatureId
      editSessionIdRef.current = editingTurfIdRef.current
      draw.changeMode('direct_select', {featureId: newFeatureId})
      raiseInteractiveLayers(map)
      void updateEditingGeometryRef.current(updated)
    }

    map.on('dblclick', handleDoubleClick)
    map.doubleClickZoom.disable()

    return (): void => {
      map.off('dblclick', handleDoubleClick)
      map.doubleClickZoom.enable()
    }
  }, [mapRef, turfActive, turfContext.editingTurfId])

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
