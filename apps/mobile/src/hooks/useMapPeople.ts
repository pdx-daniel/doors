import {api} from '@doors/api'
import type {GeoJsonFeatureCollection, MapViewport} from '@doors/api/schemas'
import {useEffect, useRef, useState} from 'react'

/** Fetch lifecycle for map people GeoJSON data. */
export type MapPeopleStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Result of the map people fetch hook. */
export type MapPeopleState = {
  data: GeoJsonFeatureCollection
  status: MapPeopleStatus
}

const emptyCollection: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

/**
 * Debounced fetch hook for people GeoJSON in the current map viewport.
 * Never throws — network failures resolve to an empty collection and `error` status.
 */
export function useMapPeople(viewport: MapViewport | null, enabled: boolean): MapPeopleState {
  const [state, setState] = useState<MapPeopleState>({
    data: emptyCollection,
    status: 'idle',
  })
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
        setState(current => ({...current, status: 'loading'}))

        try {
          const bbox = [viewport.west, viewport.south, viewport.east, viewport.north].join(',')

          // Request clustered or raw points for the current viewport and zoom.
          const {data, error} = await api.v1.map.people.get({
            query: {
              bbox,
              zoom: viewport.zoom,
              cluster: 'auto',
            },
          })

          // Ignore responses from an older viewport request.
          if (requestIdRef.current !== requestId) {
            return
          }

          if (error || !data || !('type' in data) || data.type !== 'FeatureCollection') {
            setState({data: emptyCollection, status: 'error'})
            return
          }

          setState({data, status: 'ready'})
        } catch {
          if (requestIdRef.current !== requestId) {
            return
          }

          setState({data: emptyCollection, status: 'error'})
        }
      })()
    }, 250)

    return (): void => {
      clearTimeout(timer)
    }
  }, [enabled, viewport])

  return state
}
