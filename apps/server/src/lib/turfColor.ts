/** Palette of distinct fill colors for newly created turfs. */
const TURF_COLOR_PALETTE = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
] as const

/**
 * Picks a pseudo-random turf color from the palette.
 * Uses optional seed for deterministic assignment during bulk creates.
 */
export function randomTurfColor(seed?: number): string {
  const index =
    seed !== undefined
      ? Math.abs(Math.floor(seed)) % TURF_COLOR_PALETTE.length
      : Math.floor(Math.random() * TURF_COLOR_PALETTE.length)

  return TURF_COLOR_PALETTE[index] ?? TURF_COLOR_PALETTE[0]
}
