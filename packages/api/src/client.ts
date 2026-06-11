import type {App} from '@doors/server'
import {treaty} from '@elysiajs/eden'

import {DEFAULT_API_URL, DEV_WORKSPACE_ID, WORKSPACE_ID_HEADER} from './constants'

/** Eden Treaty client type for the doors API. */
export type ApiClient = ReturnType<typeof treaty<App>>

/**
 * Creates a type-safe Eden Treaty client for the doors API.
 * @param baseUrl - API origin (no trailing slash).
 */
function createApiClient(baseUrl: string = DEFAULT_API_URL): ApiClient {
  return treaty<App>(baseUrl, {
    headers: {
      [WORKSPACE_ID_HEADER]: DEV_WORKSPACE_ID,
    },
  })
}

// Resolve the API base URL from the environment when available (web webpack DefinePlugin).
const resolvedBaseUrl =
  typeof process !== 'undefined' && process.env.DOORS_API_URL
    ? process.env.DOORS_API_URL
    : DEFAULT_API_URL

/** Shared Eden client instance used by the mobile app. */
export const api = createApiClient(resolvedBaseUrl)
