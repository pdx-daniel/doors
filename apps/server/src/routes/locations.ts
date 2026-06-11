import {
  createLocationBodySchema,
  listLocationsQuerySchema,
  updateLocationBodySchema,
} from '@doors/api/validators/location'
import {Elysia} from 'elysia'

import {getSql} from '../db/client'
import {
  createLocation,
  deleteLocation,
  getLocationById,
  listLocations,
  updateLocation,
} from '../db/repos/locationRepo'
import {parseBbox} from '../lib/queryParams'
import {workspacePlugin} from '../middleware/workspacePlugin'

/**
 * CRUD routes for workspace-scoped locations.
 */
export const locationRoutes = new Elysia({prefix: '/locations'})
  .use(workspacePlugin)
  .get(
    '/',
    async ({workspaceId, query}) => {
      const sql = getSql()
      const bbox = parseBbox(query.bbox)

      return await listLocations(sql, workspaceId, bbox)
    },
    {
      query: listLocationsQuerySchema,
    },
  )
  .get('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const location = await getLocationById(sql, workspaceId, params.id)

    // Return 404 when the location is missing in this workspace.
    if (!location) {
      set.status = 404
      return {error: 'Location not found'}
    }

    return location
  })
  .post(
    '/',
    async ({workspaceId, body}) => {
      const sql = getSql()

      // Create a location with GeoJSON geometry in the workspace scope.
      return await createLocation(sql, {
        workspaceId,
        name: body.name,
        geometry: body.geometry,
        ...(body.address !== undefined ? {address: body.address} : {}),
        ...(body.locationType !== undefined ? {locationType: body.locationType} : {}),
      })
    },
    {
      body: createLocationBodySchema,
    },
  )
  .patch(
    '/:id',
    async ({workspaceId, params, body, set}) => {
      const sql = getSql()
      const location = await updateLocation(sql, workspaceId, params.id, body)

      // Return 404 when the target location does not exist.
      if (!location) {
        set.status = 404
        return {error: 'Location not found'}
      }

      return location
    },
    {
      body: updateLocationBodySchema,
    },
  )
  .delete('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const deleted = await deleteLocation(sql, workspaceId, params.id)

    // Return 404 when nothing was deleted for the given id.
    if (!deleted) {
      set.status = 404
      return {error: 'Location not found'}
    }

    return {ok: true as const}
  })
