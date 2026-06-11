import {api} from '@doors/api'
import type {GeoJsonFeatureCollection, MapViewport} from '@doors/api/schemas'
import {useEffect, useRef, useState} from 'react'

import {EMPTY_FEATURE_COLLECTION} from '@/lib/mapPeopleLayer'

/**
 * Debounced fetch hook for people GeoJSON in the current map viewport.
 * Never throws — network failures resolve to an empty collection.
 */
export function useMapPeople(
  viewport: MapViewport | null,
  enabled: boolean,
): {data: GeoJsonFeatureCollection} {
  const [data, setData] = useState<GeoJsonFeatureCollection>(EMPTY_FEATURE_COLLECTION)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!enabled || !viewport) {
      return
    }

    // Track the latest request so stale responses are ignored after pan/zoom.
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const timer = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const bbox = [viewport.west, viewport.south, viewport.east, viewport.north].join(',')

          const {data: response, error} = await api.v1.map.people.get({
            query: {
              bbox,
              zoom: viewport.zoom,
              cluster: 'auto',
            },
          })

          if (requestIdRef.current !== requestId) {
            return
          }

          if (
            error ||
            !response ||
            !('type' in response) ||
            response.type !== 'FeatureCollection'
          ) {
            setData(EMPTY_FEATURE_COLLECTION)
            return
          }

          setData(response)
        } catch {
          if (requestIdRef.current !== requestId) {
            return
          }

          setData(EMPTY_FEATURE_COLLECTION)
        }
      })()
    }, 250)

    return (): void => {
      clearTimeout(timer)
    }
  }, [enabled, viewport])

  return {data}
}
