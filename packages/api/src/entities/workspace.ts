import {type Static, t} from 'elysia'

/** Supported workspace kinds. */
export const workspaceKindSchema = t.Union([t.Literal('personal'), t.Literal('org')])

/** Workspace kind type. */
export type WorkspaceKind = Static<typeof workspaceKindSchema>

/** Workspace row returned from the database. */
export const workspaceSchema = t.Object({
  id: t.String(),
  kind: workspaceKindSchema,
  name: t.String(),
  createdAt: t.String(),
})

/** Workspace type. */
export type Workspace = Static<typeof workspaceSchema>

/** Alias for database row naming in repos. */
export type WorkspaceRow = Workspace

/** Input for creating a workspace. */
export type CreateWorkspaceInput = {
  id?: string
  kind: WorkspaceKind
  name: string
}
