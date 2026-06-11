import {Elysia} from 'elysia'

import {missingWorkspaceResponse, readWorkspaceId} from './workspace'

/**
 * Elysia plugin that derives workspaceId from headers and rejects missing values with 400.
 */
export const workspacePlugin = new Elysia({name: 'workspace'})
  .derive({as: 'scoped'}, ({headers}) => ({
    workspaceId: readWorkspaceId(headers) ?? '',
  }))
  .onBeforeHandle({as: 'scoped'}, ({workspaceId, set}) => {
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }
  })
