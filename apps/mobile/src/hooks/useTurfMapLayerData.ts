import type {GeoJsonFeatureCollection} from '@doors/api/geo/geoJson'
import {useMemo} from 'react'

import {useTurfContext} from '@/contexts/TurfContext'
import {buildTurfFeatureCollection, MIN_TURF_VERTICES} from '@/lib/turfGeoJson'

/** GeoJSON layers derived from turf context for map rendering. */
export type TurfMapLayerData = {
  turfActive: boolean
  turfData: GeoJsonFeatureCollection
  draftData: GeoJsonFeatureCollection
}

/**
 * Builds turf and draft GeoJSON collections from TurfContext state.
 */
export function useTurfMapLayerData(): TurfMapLayerData {
  const {turfActive, turfs, selectedTurfIds, draftVertices} = useTurfContext()

  const turfData = useMemo(
    () => buildTurfFeatureCollection(turfs, selectedTurfIds),
    [selectedTurfIds, turfs],
  )

  const draftData = useMemo((): GeoJsonFeatureCollection => {
    if (draftVertices.length === 0) {
      return {type: 'FeatureCollection', features: []}
    }

    const canClose = draftVertices.length >= MIN_TURF_VERTICES

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: draftVertices,
          },
        },
        ...draftVertices.map((coordinate, index) => ({
          type: 'Feature' as const,
          properties: {
            vertexIndex: index,
            vertexNumber: index + 1,
            isCloseTarget: index === 0 && canClose,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: coordinate,
          },
        })),
      ],
    }
  }, [draftVertices])

  return {turfActive, turfData, draftData}
}
