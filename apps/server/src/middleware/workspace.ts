import {WORKSPACE_ID_HEADER} from '@doors/api/constants'

/**
 * Reads the workspace id header from an incoming request.
 */
export function readWorkspaceId(headers: Record<string, string | undefined>): string | null {
  const workspaceId = headers[WORKSPACE_ID_HEADER]

  // Accept only non-empty string header values.
  if (typeof workspaceId !== 'string' || !workspaceId) {
    return null
  }

  return workspaceId
}

/**
 * Returns a 400 response body when the workspace header is missing.
 */
export function missingWorkspaceResponse(): {error: string} {
  return {error: `Missing ${WORKSPACE_ID_HEADER} header`}
}
