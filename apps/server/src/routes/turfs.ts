import {createTurfBodySchema, updateTurfBodySchema} from '@doors/api/validators/turf'
import {Elysia} from 'elysia'

import {getSql} from '../db/client'
import {createTurf, deleteTurf, getTurfById, listTurfs, updateTurf} from '../db/repos/turfRepo'
import {workspacePlugin} from '../middleware/workspacePlugin'

/**
 * CRUD routes for workspace-scoped turfs (polygon areas with metadata).
 */
export const turfRoutes = new Elysia({prefix: '/turfs'})
  .use(workspacePlugin)
  .get('/', async ({workspaceId}) => {
    const sql = getSql()
    const turfs = await listTurfs(sql, workspaceId)

    // Plain JSON round-trip so Elysia serializes the array (not [object Object] per row).
    return JSON.parse(JSON.stringify(turfs))
  })
  .get('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const turf = await getTurfById(sql, workspaceId, params.id)

    if (!turf) {
      set.status = 404
      return {error: 'Turf not found'}
    }

    return turf
  })
  .post(
    '/',
    async ({workspaceId, body}) => {
      const sql = getSql()

      return await createTurf(sql, {
        workspaceId,
        geometry: body.geometry,
        ...(body.name !== undefined ? {name: body.name} : {}),
        ...(body.color !== undefined ? {color: body.color} : {}),
      })
    },
    {
      body: createTurfBodySchema,
    },
  )
  .patch(
    '/:id',
    async ({workspaceId, params, body, set}) => {
      const sql = getSql()
      const turf = await updateTurf(sql, workspaceId, params.id, body)

      if (!turf) {
        set.status = 404
        return {error: 'Turf not found'}
      }

      return turf
    },
    {
      body: updateTurfBodySchema,
    },
  )
  .delete('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const deleted = await deleteTurf(sql, workspaceId, params.id)

    if (!deleted) {
      set.status = 404
      return {error: 'Turf not found'}
    }

    return {ok: true as const}
  })
