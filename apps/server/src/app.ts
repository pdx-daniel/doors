import {cors} from '@elysiajs/cors'
import {Elysia} from 'elysia'

import {locationRoutes} from './routes/locations'
import {mapRoutes} from './routes/map'
import {peopleRoutes} from './routes/people'
import {statsRoutes} from './routes/stats'
import {turfRoutes} from './routes/turfs'

/** Versioned API routes scoped by workspace header. */
const v1Routes = new Elysia({prefix: '/v1'})
  .use(locationRoutes)
  .use(peopleRoutes)
  .use(mapRoutes)
  .use(statsRoutes)
  .use(turfRoutes)

/** Elysia application definition — exported for Eden Treaty type inference. */
export const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ok: true as const, service: 'doors'}))
  .use(v1Routes)

/** Eden Treaty uses this type to generate the client API surface. */
export type App = typeof app
