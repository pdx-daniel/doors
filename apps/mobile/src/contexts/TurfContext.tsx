import type {TurfResource} from '@doors/api/entities/turf'
import type {GeoJsonPolygon} from '@doors/api/geo/geoJson'
import type {ReactElement, ReactNode} from 'react'
import {createContext, useCallback, useContext, useMemo, useState} from 'react'

import {useTurfs} from '@/hooks/useTurfs'
import {closePolygonRing, MIN_TURF_VERTICES} from '@/lib/turfGeoJson'
import type {RootTabRouteName} from '@/navigation/routes'

/** Turf sub-tool mode: draw new polygons or select existing ones. */
export type TurfToolMode = 'draw' | 'select'

type TurfContextValue = {
  turfActive: boolean
  toolMode: TurfToolMode
  setToolMode: (mode: TurfToolMode) => void
  turfs: TurfResource[]
  turfsLoading: boolean
  selectedTurfIds: ReadonlySet<string>
  editingTurfId: string | null
  editingName: string
  setEditingName: (name: string) => void
  draftVertices: [number, number][]
  panModifierActive: boolean
  setPanModifierActive: (active: boolean) => void
  toggleSelectTurf: (turfId: string) => void
  clearSelection: () => void
  enterEditMode: () => void
  cancelEditMode: () => void
  saveEditMode: () => Promise<void>
  updateEditingGeometry: (geometry: GeoJsonPolygon) => Promise<void>
  startDraw: () => void
  cancelDraw: () => void
  addDraftVertex: (vertex: [number, number]) => void
  completeDraftDraw: () => Promise<void>
  requestDeleteTurf: (turfId: string) => void
  confirmDeleteTurf: (turfId: string) => Promise<void>
  pendingDeleteTurfId: string | null
  clearPendingDelete: () => void
}

const TurfContext = createContext<TurfContextValue | null>(null)

type TurfProviderProps = {
  activeRoute: RootTabRouteName
  children: ReactNode
}

/**
 * Provides turf mode state shared by the map, sub-toolbar, and context menus.
 */
export function TurfProvider({activeRoute, children}: TurfProviderProps): ReactElement {
  const turfActive = activeRoute === 'Turf'
  const [toolMode, setToolModeState] = useState<TurfToolMode>('select')
  const [selectedTurfIds, setSelectedTurfIds] = useState<Set<string>>(() => new Set())
  const [editingTurfId, setEditingTurfId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [draftVertices, setDraftVertices] = useState<[number, number][]>([])
  const [panModifierActive, setPanModifierActive] = useState(false)
  const [pendingDeleteTurfId, setPendingDeleteTurfId] = useState<string | null>(null)

  const {turfs, loading: turfsLoading, createTurf, updateTurf, deleteTurf} = useTurfs(turfActive)

  const setToolMode = useCallback((mode: TurfToolMode): void => {
    setToolModeState(mode)
    setDraftVertices([])
    setEditingTurfId(null)
    setEditingName('')
  }, [])

  const clearSelection = useCallback((): void => {
    setSelectedTurfIds(new Set())
    setEditingTurfId(null)
    setEditingName('')
  }, [])

  const toggleSelectTurf = useCallback((turfId: string): void => {
    setSelectedTurfIds(previous => {
      const next = new Set(previous)
      if (next.has(turfId)) {
        next.delete(turfId)
      } else {
        next.add(turfId)
      }

      return next
    })
    setEditingTurfId(null)
    setEditingName('')
  }, [])

  const startDraw = useCallback((): void => {
    setToolMode('draw')
    setDraftVertices([])
    clearSelection()
  }, [clearSelection, setToolMode])

  const cancelDraw = useCallback((): void => {
    setDraftVertices([])
    setToolMode('select')
  }, [setToolMode])

  const completeDraftDraw = useCallback(async (): Promise<void> => {
    if (toolMode !== 'draw' || draftVertices.length < MIN_TURF_VERTICES) {
      return
    }

    const polygon = closePolygonRing(draftVertices)
    if (!polygon) {
      return
    }

    await createTurf(polygon)
    setDraftVertices([])
    setToolMode('select')
  }, [createTurf, draftVertices, setToolMode, toolMode])

  const addDraftVertex = useCallback(
    (vertex: [number, number]): void => {
      if (toolMode !== 'draw' || panModifierActive) {
        return
      }

      setDraftVertices(previous => [...previous, vertex])
    },
    [panModifierActive, toolMode],
  )

  const enterEditMode = useCallback((): void => {
    if (selectedTurfIds.size !== 1) {
      return
    }

    const turfId = [...selectedTurfIds][0]
    if (!turfId) {
      return
    }

    const turf = turfs.find(entry => entry.id === turfId)
    setEditingTurfId(turfId)
    setEditingName(turf?.name ?? '')
  }, [selectedTurfIds, turfs])

  const cancelEditMode = useCallback((): void => {
    setEditingTurfId(null)
    setEditingName('')
  }, [])

  const saveEditMode = useCallback(async (): Promise<void> => {
    if (!editingTurfId) {
      return
    }

    await updateTurf(editingTurfId, {name: editingName})
    setEditingTurfId(null)
    setEditingName('')
  }, [editingName, editingTurfId, updateTurf])

  const updateEditingGeometry = useCallback(
    async (geometry: GeoJsonPolygon): Promise<void> => {
      if (!editingTurfId) {
        return
      }

      await updateTurf(editingTurfId, {geometry})
    },
    [editingTurfId, updateTurf],
  )

  const requestDeleteTurf = useCallback((turfId: string): void => {
    setPendingDeleteTurfId(turfId)
  }, [])

  const confirmDeleteTurf = useCallback(
    async (turfId: string): Promise<void> => {
      const deleted = await deleteTurf(turfId)
      if (deleted) {
        setSelectedTurfIds(previous => {
          const next = new Set(previous)
          next.delete(turfId)
          return next
        })
        if (editingTurfId === turfId) {
          setEditingTurfId(null)
          setEditingName('')
        }
      }

      setPendingDeleteTurfId(null)
    },
    [deleteTurf, editingTurfId],
  )

  const clearPendingDelete = useCallback((): void => {
    setPendingDeleteTurfId(null)
  }, [])

  const value = useMemo(
    (): TurfContextValue => ({
      turfActive,
      toolMode,
      setToolMode,
      turfs,
      turfsLoading,
      selectedTurfIds,
      editingTurfId,
      editingName,
      setEditingName,
      draftVertices,
      panModifierActive,
      setPanModifierActive,
      toggleSelectTurf,
      clearSelection,
      enterEditMode,
      cancelEditMode,
      saveEditMode,
      updateEditingGeometry,
      startDraw,
      cancelDraw,
      addDraftVertex,
      completeDraftDraw,
      requestDeleteTurf,
      confirmDeleteTurf,
      pendingDeleteTurfId,
      clearPendingDelete,
    }),
    [
      addDraftVertex,
      cancelDraw,
      cancelEditMode,
      clearPendingDelete,
      clearSelection,
      completeDraftDraw,
      confirmDeleteTurf,
      draftVertices,
      editingName,
      editingTurfId,
      enterEditMode,
      panModifierActive,
      pendingDeleteTurfId,
      requestDeleteTurf,
      saveEditMode,
      updateEditingGeometry,
      selectedTurfIds,
      setToolMode,
      startDraw,
      toggleSelectTurf,
      toolMode,
      turfActive,
      turfs,
      turfsLoading,
    ],
  )

  return <TurfContext.Provider value={value}>{children}</TurfContext.Provider>
}

/**
 * Reads turf mode state; throws when used outside TurfProvider.
 */
export function useTurfContext(): TurfContextValue {
  const context = useContext(TurfContext)
  if (!context) {
    throw new Error('useTurfContext must be used within TurfProvider')
  }

  return context
}

/**
 * Returns client-only selected turf ids for future external selection wiring.
 */
export function useTurfSelection(): ReadonlySet<string> {
  return useTurfContext().selectedTurfIds
}
