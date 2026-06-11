import {createPersonBodySchema, updatePersonBodySchema} from '@doors/api/validators/person'
import {Elysia} from 'elysia'

import {getSql} from '../db/client'
import {
  createPerson,
  deletePerson,
  getPersonById,
  LocationWorkspaceMismatchError,
  listPeople,
  updatePerson,
} from '../db/repos/personRepo'
import {workspacePlugin} from '../middleware/workspacePlugin'

/**
 * CRUD routes for workspace-scoped people.
 */
export const peopleRoutes = new Elysia({prefix: '/people'})
  .use(workspacePlugin)
  .get('/', async ({workspaceId}) => {
    const sql = getSql()

    // List all people in the workspace ordered by display name.
    return await listPeople(sql, workspaceId)
  })
  .get('/:id', async ({workspaceId, params, set}) => {
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
    async ({workspaceId, body, set}) => {
      const sql = getSql()

      try {
        // Create a person linked to an optional location in the workspace.
        return await createPerson(sql, {
          workspaceId,
          displayName: body.displayName,
          ...(body.email !== undefined ? {email: body.email} : {}),
          ...(body.phone !== undefined ? {phone: body.phone} : {}),
          ...(body.locationId !== undefined ? {locationId: body.locationId} : {}),
          ...(body.metadata !== undefined ? {metadata: body.metadata} : {}),
        })
      } catch (error) {
        if (error instanceof LocationWorkspaceMismatchError) {
          set.status = 400
          return {error: error.message}
        }

        throw error
      }
    },
    {
      body: createPersonBodySchema,
    },
  )
  .patch(
    '/:id',
    async ({workspaceId, params, body, set}) => {
      const sql = getSql()

      try {
        const person = await updatePerson(sql, workspaceId, params.id, body)

        // Return 404 when the target person does not exist.
        if (!person) {
          set.status = 404
          return {error: 'Person not found'}
        }

        return person
      } catch (error) {
        if (error instanceof LocationWorkspaceMismatchError) {
          set.status = 400
          return {error: error.message}
        }

        throw error
      }
    },
    {
      body: updatePersonBodySchema,
    },
  )
  .delete('/:id', async ({workspaceId, params, set}) => {
    const sql = getSql()
    const deleted = await deletePerson(sql, workspaceId, params.id)

    // Return 404 when nothing was deleted for the given id.
    if (!deleted) {
      set.status = 404
      return {error: 'Person not found'}
    }

    return {ok: true as const}
  })
