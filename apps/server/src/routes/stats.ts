import {Elysia, t} from 'elysia'

import {getSql} from '../db/client'
import {metadataFieldKey} from '../db/geo/mapFilters'
import {queryPeopleHistogram} from '../db/repos/mapQueryRepo'
import {buildMapPeopleFilters, type MapQueryParams} from '../lib/queryParams'
import {workspacePlugin} from '../middleware/workspacePlugin'

/**
 * Stats routes for aggregated people metadata.
 */
export const statsRoutes = new Elysia({prefix: '/stats'}).use(workspacePlugin).get(
  '/histogram',
  async ({workspaceId, query}) => {
    const sql = getSql()
    const filters = buildMapPeopleFilters(workspaceId, query as MapQueryParams)

    // Group people by a metadata field value within optional geo filters.
    const buckets = await queryPeopleHistogram(sql, filters, metadataFieldKey(query.field))

    return {
      field: query.field,
      buckets,
    }
  },
  {
    query: t.Object({
      field: t.String(),
      bbox: t.Optional(t.String()),
      radius: t.Optional(t.String()),
      polygon: t.Optional(t.String()),
      q: t.Optional(t.String()),
      filter: t.Optional(t.String()),
      jsonpath: t.Optional(t.String()),
    }),
  },
)
