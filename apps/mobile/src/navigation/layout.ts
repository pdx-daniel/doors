/** Vertical space taken by the floating nav pill (padding + label row). */
export const FLOATING_NAV_HEIGHT = 56

/** Gap between the nav pill and screen edges. */
export const FLOATING_NAV_MARGIN = 12

/** Extra inset between the nav pill and scrollable content. */
export const FLOATING_NAV_CONTENT_GAP = 16

/**
 * Content insets that keep body UI clear of the floating nav bar.
 * Nav sits at the top on web and at the bottom on native.
 */
export function getFloatingNavContentInsets(
  insets: {top: number; bottom: number},
  isWeb: boolean,
): {paddingTop: number; paddingBottom: number} {
  const navBlock = FLOATING_NAV_HEIGHT + FLOATING_NAV_MARGIN + FLOATING_NAV_CONTENT_GAP

  if (isWeb) {
    return {
      paddingTop: insets.top + navBlock,
      paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_GAP,
    }
  }

  return {
    paddingTop: insets.top + FLOATING_NAV_CONTENT_GAP,
    paddingBottom: insets.bottom + navBlock,
  }
}

/**
 * Absolute positioning for a floating card panel over the map.
 * Same inset logic as full-page content but uses top/bottom for absolute layout.
 */
export function getFloatingPanelInsets(
  insets: {top: number; bottom: number},
  isWeb: boolean,
): {top: number; bottom: number} {
  const contentInsets = getFloatingNavContentInsets(insets, isWeb)

  return {
    top: contentInsets.paddingTop,
    bottom: contentInsets.paddingBottom,
  }
}
