import type {GeoJsonFeatureCollection, MapViewport} from '@doors/api/schemas'
import type {StyleSpecification} from 'maplibre-gl'
import {useCallback, useMemo, useState} from 'react'

import {getBasemapPmtilesUrl, getRemoteFallbackStyleUrl, type MapAppearance} from '@/constants/map'
import {useApiHealth} from '@/contexts/ApiHealthContext'
import {useMapAppearance} from '@/hooks/useMapAppearance'
import {useMapPeople} from '@/hooks/useMapPeople'
import {buildBasemapStyle} from '@/lib/basemapStyle'
import {logMapPersonFeature} from '@/lib/logMapPersonFeature'

/** Shared map orchestration state for web and native MapView implementations. */
export type MapViewModel = {
  appearance: MapAppearance
  viewport: MapViewport | null
  setViewport: (viewport: MapViewport) => void
  peopleData: GeoJsonFeatureCollection
  peopleEnabled: boolean
  mapStyle: string | StyleSpecification
  onBasemapFailure: () => void
  onPeoplePress: (properties: unknown) => void
}

/**
 * Shared hook for map appearance, health gating, people data, and basemap selection.
 */
export function useMapViewModel(): MapViewModel {
  const appearance = useMapAppearance()
  const apiHealth = useApiHealth()
  const peopleEnabled = apiHealth === 'ok'
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const {data: peopleData} = useMapPeople(viewport, peopleEnabled)

  const mapStyle = useMemo((): string | StyleSpecification => {
    if (fallbackUsed) {
      return getRemoteFallbackStyleUrl(appearance)
    }

    return buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
  }, [appearance, fallbackUsed])

  const onBasemapFailure = useCallback((): void => {
    setFallbackUsed(previous => {
      if (previous) {
        return previous
      }

      return true
    })
  }, [])

  const onPeoplePress = useCallback((properties: unknown): void => {
    logMapPersonFeature(properties)
  }, [])

  return {
    appearance,
    viewport,
    setViewport,
    peopleData,
    peopleEnabled,
    mapStyle,
    onBasemapFailure,
    onPeoplePress,
  }
}
