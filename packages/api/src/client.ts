import type {App} from '@doors/server'
import {treaty} from '@elysiajs/eden'

import {DEV_WORKSPACE_ID, WORKSPACE_ID_HEADER} from './constants'

/** Default API origin for local development. */
const defaultBaseUrl = 'http://localhost:3000'

/**
 * Creates a type-safe Eden Treaty client for the doors API.
 * @param baseUrl - API origin (no trailing slash).
 */
export function createApiClient(baseUrl: string = defaultBaseUrl): ReturnType<typeof treaty<App>> {
  return treaty<App>(baseUrl, {
    headers: {
      [WORKSPACE_ID_HEADER]: DEV_WORKSPACE_ID,
    },
  })
}

// Resolve the API base URL from the environment when available.
const resolvedBaseUrl =
  typeof process !== 'undefined' && process.env.DOORS_API_URL
    ? process.env.DOORS_API_URL
    : defaultBaseUrl

/** Shared Eden client instance used by the mobile app. */
export const api = createApiClient(resolvedBaseUrl)
