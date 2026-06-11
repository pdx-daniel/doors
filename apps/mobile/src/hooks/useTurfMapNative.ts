import type {GeoJsonPolygon} from '@doors/api/geo/geoJson'
import type {PressEvent, PressEventWithFeatures} from '@maplibre/maplibre-react-native'
import {useCallback, useEffect, useState} from 'react'
import type {NativeSyntheticEvent} from 'react-native'

import {useTurfContext} from '@/contexts/TurfContext'
import {useTurfMapLayerData} from '@/hooks/useTurfMapLayerData'
import {findTurfAtCoordinate} from '@/lib/pointInPolygon'
import {findNearDraftVertexIndex, isNearFirstVertex, MIN_TURF_VERTICES} from '@/lib/turfGeoJson'

/** Result of native turf map press handlers. */
export type TurfMapNativeHandlers = {
  handleMapPress: (
    event: NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>,
  ) => void
  handleMapLongPress: (event: NativeSyntheticEvent<PressEvent>) => void
  handleTurfSourcePress: (event: NativeSyntheticEvent<PressEventWithFeatures>) => void
  editVertexData: GeoJsonPolygon | null
  draggingVertexIndex: number | null
}

/**
 * Native turf map interaction handlers (draw, select, long-press delete, vertex edit).
 */
export function useTurfMapNative(): TurfMapNativeHandlers {
  const turfContext = useTurfContext()
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null)

  const editVertexData =
    turfContext.editingTurfId !== null
      ? ((turfContext.turfs.find(entry => entry.id === turfContext.editingTurfId)?.geometry as
          | GeoJsonPolygon
          | undefined) ?? null)
      : null

  useEffect(() => {
    if (!turfContext.turfActive) {
      setDraggingVertexIndex(null)
    }
  }, [turfContext.turfActive])

  const getClickCoordinate = useCallback(
    (
      event: NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>,
    ): [number, number] | null => {
      const lngLat = event.nativeEvent.lngLat
      if (!lngLat) {
        return null
      }

      return [lngLat[0], lngLat[1]]
    },
    [],
  )

  const getTurfIdFromEvent = useCallback(
    (
      event: NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>,
    ): string | null => {
      const features = 'features' in event.nativeEvent ? (event.nativeEvent.features ?? []) : []
      const turfFeature = features.find(entry => typeof entry.properties?.turfId === 'string')

      return typeof turfFeature?.properties?.turfId === 'string'
        ? turfFeature.properties.turfId
        : null
    },
    [],
  )

  const handleMapPress = useCallback(
    (
      event: NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>,
    ): void => {
      if (!turfContext.turfActive) {
        return
      }

      const turfId = getTurfIdFromEvent(event)

      if (
        typeof turfId === 'string' &&
        turfContext.toolMode === 'select' &&
        !turfContext.editingTurfId
      ) {
        return
      }

      const click = getClickCoordinate(event)
      if (!click) {
        return
      }

      if (turfContext.editingTurfId && editVertexData?.type === 'Polygon') {
        const ring = editVertexData.coordinates[0] ?? []
        const vertices = ring.slice(0, -1) as [number, number][]

        if (draggingVertexIndex !== null) {
          const nextRing = vertices.map((vertex, index) =>
            index === draggingVertexIndex ? click : vertex,
          )
          nextRing.push(nextRing[0] ?? click)
          void turfContext.updateEditingGeometry({
            type: 'Polygon',
            coordinates: [nextRing],
          })
          setDraggingVertexIndex(null)
          return
        }

        const nearIndex = vertices.findIndex(vertex => isNearFirstVertex(click, vertex, 0.0002))
        if (nearIndex >= 0) {
          setDraggingVertexIndex(nearIndex)
        }

        return
      }

      if (turfContext.toolMode === 'draw') {
        if (turfContext.panModifierActive) {
          return
        }

        const nearVertexIndex = findNearDraftVertexIndex(click, turfContext.draftVertices)
        const canClose = turfContext.draftVertices.length >= MIN_TURF_VERTICES

        if (canClose && nearVertexIndex === 0) {
          void turfContext.completeDraftDraw()
          return
        }

        if (nearVertexIndex !== null) {
          return
        }

        void turfContext.addDraftVertex(click)
        return
      }

      if (turfContext.toolMode === 'select' && !turfId) {
        turfContext.clearSelection()
      }
    },
    [draggingVertexIndex, editVertexData, getClickCoordinate, getTurfIdFromEvent, turfContext],
  )

  const handleTurfSourcePress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>): void => {
      if (
        !turfContext.turfActive ||
        turfContext.toolMode !== 'select' ||
        turfContext.editingTurfId
      ) {
        return
      }

      const turfId = getTurfIdFromEvent(event)
      if (typeof turfId === 'string') {
        turfContext.toggleSelectTurf(turfId)
      }
    },
    [getTurfIdFromEvent, turfContext],
  )

  const handleMapLongPress = useCallback(
    (event: NativeSyntheticEvent<PressEvent>): void => {
      if (!turfContext.turfActive) {
        return
      }

      const turfId = getTurfIdFromEvent(event)
      if (typeof turfId === 'string') {
        turfContext.requestDeleteTurf(turfId)
        return
      }

      const click = getClickCoordinate(event)
      if (!click) {
        return
      }

      const turf = findTurfAtCoordinate(turfContext.turfs, click[0], click[1])
      if (turf) {
        turfContext.requestDeleteTurf(turf.id)
      }
    },
    [getClickCoordinate, getTurfIdFromEvent, turfContext],
  )

  return {
    handleMapPress,
    handleMapLongPress,
    handleTurfSourcePress,
    editVertexData,
    draggingVertexIndex,
  }
}

/** Re-export layer data for native MapView rendering. */
export function useTurfMapNativeLayers(): ReturnType<typeof useTurfMapLayerData> {
  return useTurfMapLayerData()
}
