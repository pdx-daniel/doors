import {Elysia, t} from 'elysia'

import {getSql} from '../db/client'
import {
  createPerson,
  deletePerson,
  getPersonById,
  listPeople,
  updatePerson,
} from '../db/repos/personRepo'
import {missingWorkspaceResponse, readWorkspaceId} from '../middleware/workspace'

/**
 * CRUD routes for workspace-scoped people.
 */
export const peopleRoutes = new Elysia({prefix: '/people'})
  .get('/', async ({headers, set}) => {
    const workspaceId = readWorkspaceId(headers)
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }

    const sql = getSql()

    // List all people in the workspace ordered by display name.
    return await listPeople(sql, workspaceId)
  })
  .get('/:id', async ({headers, params, set}) => {
    const workspaceId = readWorkspaceId(headers)
    if (!workspaceId) {
      set.status = 400
      return missingWorkspaceResponse()
    }

    const sql = getSql()
    const person = await getPersonById(sql, workspaceId, params.id)

    // Return 404 when the person is missing in this workspace.
    if (!person) {
      set.status = 404
      return {error: 'Person not found'}
    }

    return person
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

      // Create a person linked to an optional location in the workspace.
      return await createPerson(sql, {
        workspaceId,
        displayName: body.displayName,
        ...(body.email !== undefined ? {email: body.email} : {}),
        ...(body.phone !== undefined ? {phone: body.phone} : {}),
        ...(body.locationId !== undefined ? {locationId: body.locationId} : {}),
        ...(body.metadata !== undefined ? {metadata: body.metadata} : {}),
      })
    },
    {
      body: t.Object({
        displayName: t.String(),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        locationId: t.Optional(t.Union([t.String(), t.Null()])),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
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
      const person = await updatePerson(sql, workspaceId, params.id, body)

      // Return 404 when the target person does not exist.
      if (!person) {
        set.status = 404
        return {error: 'Person not found'}
      }

      return person
    },
    {
      body: t.Object({
        displayName: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        locationId: t.Optional(t.Union([t.String(), t.Null()])),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
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
    const deleted = await deletePerson(sql, workspaceId, params.id)

    // Return 404 when nothing was deleted for the given id.
    if (!deleted) {
      set.status = 404
      return {error: 'Person not found'}
    }

    return {ok: true as const}
  })
