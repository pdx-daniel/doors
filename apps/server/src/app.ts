import {cors} from '@elysiajs/cors'
import {Elysia} from 'elysia'

/** Elysia application definition — exported for Eden Treaty type inference. */
export const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ok: true as const, service: 'doors'}))

/** Eden Treaty uses this type to generate the client API surface. */
export type App = typeof app
