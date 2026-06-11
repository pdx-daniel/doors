import type {ReactElement} from 'react'
import {useEffect} from 'react'
import {Platform, Pressable, TextInput} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {Box} from '@/components/ui/box'
import {Text} from '@/components/ui/text'
import {useTurfContext} from '@/contexts/TurfContext'
import {getTurfSubToolbarInsets} from '@/navigation/layout'

/**
 * Draw / Select sub-toolbar shown on the Turf tab below (web) or above (native) main nav.
 */
export function TurfSubToolbar(): ReactElement | null {
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'
  const positionStyle = getTurfSubToolbarInsets(insets, isWeb)

  const {
    turfActive,
    toolMode,
    setToolMode,
    selectedTurfIds,
    editingTurfId,
    editingName,
    setEditingName,
    enterEditMode,
    cancelEditMode,
    saveEditMode,
    cancelDraw,
    pendingDeleteTurfId,
    confirmDeleteTurf,
    clearPendingDelete,
  } = useTurfContext()

  useEffect(() => {
    if (!isWeb || !turfActive) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (toolMode === 'draw') {
          cancelDraw()
        } else if (editingTurfId) {
          cancelEditMode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [cancelDraw, cancelEditMode, editingTurfId, isWeb, toolMode, turfActive])

  if (!turfActive) {
    return null
  }

  const canEdit = selectedTurfIds.size === 1 && !editingTurfId
  const isEditing = editingTurfId !== null

  return (
    <>
      <Box className="absolute inset-x-4 z-40" pointerEvents="box-none" style={positionStyle}>
        <Box className="flex-row flex-wrap items-center gap-2 rounded-full border border-white/10 bg-gray-900/90 px-3 py-2 shadow-lg">
          <ToolButton
            active={toolMode === 'draw'}
            label="Draw"
            onPress={(): void => setToolMode('draw')}
          />
          <ToolButton
            active={toolMode === 'select'}
            label="Select"
            onPress={(): void => setToolMode('select')}
          />
          {toolMode === 'draw' ? (
            <ToolButton active={false} label="Cancel" onPress={cancelDraw} />
          ) : null}
          {toolMode === 'select' && canEdit ? (
            <ToolButton active={false} label="Edit" onPress={enterEditMode} />
          ) : null}
          {isEditing ? (
            <>
              <TextInput
                accessibilityLabel="Turf name"
                className="min-w-24 flex-1 rounded-full border border-white/20 bg-gray-800 px-3 py-1.5 text-sm text-gray-50 web:outline-none"
                onChangeText={setEditingName}
                placeholder="Name (optional)"
                placeholderTextColor="#9ca3af"
                value={editingName}
              />
              <ToolButton
                active={false}
                label="Save"
                onPress={(): void => {
                  void saveEditMode()
                }}
              />
              <ToolButton active={false} label="Cancel" onPress={cancelEditMode} />
            </>
          ) : null}
        </Box>
      </Box>
      {pendingDeleteTurfId ? (
        <Box className="absolute inset-0 z-50 items-center justify-center bg-black/40">
          <Box className="mx-6 max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-5">
            <Text className="mb-4 text-base text-gray-50">Delete this turf?</Text>
            <Box className="flex-row justify-end gap-3">
              <Pressable accessibilityRole="button" onPress={clearPendingDelete}>
                <Text className="px-3 py-2 text-sm text-gray-400">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={(): void => {
                  void confirmDeleteTurf(pendingDeleteTurfId)
                }}>
                <Text className="px-3 py-2 text-sm font-semibold text-red-400">Delete</Text>
              </Pressable>
            </Box>
          </Box>
        </Box>
      ) : null}
    </>
  )
}

type ToolButtonProps = {
  label: string
  active: boolean
  onPress: () => void
}

/** Segmented control button for turf tool modes. */
function ToolButton({label, active, onPress}: ToolButtonProps): ReactElement {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{selected: active}} onPress={onPress}>
      <Box className={`rounded-full px-3 py-1.5 ${active ? 'bg-white/10' : ''}`}>
        <Text className={`text-sm font-medium ${active ? 'text-gray-50' : 'text-gray-400'}`}>
          {label}
        </Text>
      </Box>
    </Pressable>
  )
}
