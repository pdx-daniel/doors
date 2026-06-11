import {Elysia, t} from 'elysia'

import {getSql} from '../db/client'
import {
  createLocation,
  deleteLocation,
  getLocationById,
  listLocations,
  updateLocation,
} from '../db/repos/locationRepo'
import {missingWorkspaceResponse, readWorkspaceId} from '../middleware/workspace'

const geometrySchema = t.Object({
  type: t.String(),
  coordinates: t.Unknown(),
})

/**
 * CRUD routes for workspace-scoped locations.
 */
export const locationRoutes = new Elysia({prefix: '/locations'})
  .get(
    '/',
    async ({headers, query, set}) => {
      const workspaceId = readWorkspaceId(headers)
      if (!workspaceId) {
        set.status = 400
        return missingWorkspaceResponse()
      }

      const sql = getSql()

      // Parse an optional bbox filter from comma-separated query params.
      const bbox = query.bbox
        ? ((): {west: number; south: number; east: number; north: number} => {
            const parts = query.bbox.split(',').map(Number)
            return {
              west: parts[0] ?? 0,
              south: parts[1] ?? 0,
              east: parts[2] ?? 0,
              north: parts[3] ?? 0,
            }
          })()
        : undefined

      return await listLocations(sql, workspaceId, bbox)
    },
    {
      query: t.Object({
        bbox: t.Optional(t.String()),
      }),
    },
  )
  .get('/:id', async ({headers, params, set}) => {
    const workspaceId = readWorkspaceId(headers)
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }

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
    async ({headers, body, set}) => {
      const workspaceId = readWorkspaceId(headers)
      if (!workspaceId) {
        set.status = 400
        return missingWorkspaceResponse()
      }

      const sql = getSql()

      // Create a location with GeoJSON geometry in the workspace scope.
      return await createLocation(sql, {
        workspaceId,
        name: body.name,
        ...(body.address !== undefined ? {address: body.address} : {}),
        ...(body.locationType !== undefined ? {locationType: body.locationType} : {}),
        geometry: body.geometry,
      })
    },
    {
      body: t.Object({
        name: t.String(),
        address: t.Optional(t.String()),
        locationType: t.Optional(t.String()),
        geometry: geometrySchema,
      }),
    },
  )
  .patch(
    '/:id',
    async ({headers, params, body, set}) => {
      const workspaceId = readWorkspaceId(headers)
      if (!workspaceId) {
        set.status = 400
        return missingWorkspaceResponse()
      }

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
      body: t.Object({
        name: t.Optional(t.String()),
        address: t.Optional(t.String()),
        locationType: t.Optional(t.String()),
        geometry: t.Optional(geometrySchema),
      }),
    },
  )
  .delete('/:id', async ({headers, params, set}) => {
    const workspaceId = readWorkspaceId(headers)
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }

    const sql = getSql()
    const deleted = await deleteLocation(sql, workspaceId, params.id)

    // Return 404 when nothing was deleted for the given id.
    if (!deleted) {
      set.status = 404
      return {error: 'Location not found'}
    }

    return {ok: true as const}
  })
