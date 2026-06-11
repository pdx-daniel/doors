import {api} from '@doors/api'
import type {TurfResource} from '@doors/api/entities/turf'
import type {GeoJsonPolygon} from '@doors/api/geo/geoJson'
import {useCallback, useEffect, useRef, useState} from 'react'

/** Result of turf CRUD operations against the API. */
export type UseTurfsResult = {
  turfs: TurfResource[]
  loading: boolean
  error: string | null
  refreshTurfs: () => Promise<void>
  createTurf: (geometry: GeoJsonPolygon, name?: string) => Promise<TurfResource | null>
  updateTurf: (
    turfId: string,
    patch: {name?: string; geometry?: GeoJsonPolygon},
  ) => Promise<TurfResource | null>
  deleteTurf: (turfId: string) => Promise<boolean>
}

/**
 * Fetches and mutates workspace turfs via the Eden Treaty client.
 */
export function useTurfs(enabled: boolean): UseTurfsResult {
  const [turfs, setTurfs] = useState<TurfResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const refreshTurfs = useCallback(async (): Promise<void> => {
    if (!enabled) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const response = await api.v1.turfs.get()

      if (requestIdRef.current !== requestId) {
        return
      }

      if (response.error || !Array.isArray(response.data)) {
        setError('Failed to load turfs')
        setTurfs([])
        return
      }

      setTurfs(response.data)
    } catch {
      if (requestIdRef.current === requestId) {
        setError('Failed to load turfs')
        setTurfs([])
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [enabled])

  useEffect(() => {
    void refreshTurfs()
  }, [refreshTurfs])

  const createTurf = useCallback(
    async (geometry: GeoJsonPolygon, name?: string): Promise<TurfResource | null> => {
      try {
        const response = await api.v1.turfs.post({
          geometry,
          ...(name !== undefined ? {name} : {}),
        })

        if (response.error || !response.data) {
          return null
        }

        const created = response.data as TurfResource
        setTurfs(previous => [...previous, created])
        return created
      } catch {
        return null
      }
    },
    [],
  )

  const updateTurf = useCallback(
    async (
      turfId: string,
      patch: {name?: string; geometry?: GeoJsonPolygon},
    ): Promise<TurfResource | null> => {
      try {
        const response = await api.v1.turfs({id: turfId}).patch(patch)

        if (response.error || !response.data) {
          return null
        }

        const updated = response.data as TurfResource
        setTurfs(previous => previous.map(turf => (turf.id === turfId ? updated : turf)))
        return updated
      } catch {
        return null
      }
    },
    [],
  )

  const deleteTurf = useCallback(async (turfId: string): Promise<boolean> => {
    try {
      const response = await api.v1.turfs({id: turfId}).delete()

      if (response.error) {
        return false
      }

      setTurfs(previous => previous.filter(turf => turf.id !== turfId))
      return true
    } catch {
      return false
    }
  }, [])

  return {
    turfs,
    loading,
    error,
    refreshTurfs,
    createTurf,
    updateTurf,
    deleteTurf,
  }
}
