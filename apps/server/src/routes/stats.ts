import {histogramQuerySchema} from '@doors/api/validators/stats'
import {Elysia} from 'elysia'

import {getSql} from '../db/client'
import {metadataFieldKey} from '../db/geo/mapFilters'
import {queryPeopleHistogram} from '../db/repos/mapQueryRepo'
import {buildMapPeopleFilters} from '../lib/queryParams'
import {workspacePlugin} from '../middleware/workspacePlugin'

/**
 * Stats routes for aggregated people metadata.
 */
export const statsRoutes = new Elysia({prefix: '/stats'}).use(workspacePlugin).get(
  '/histogram',
  async ({workspaceId, query}) => {
    const sql = getSql()
    const filters = buildMapPeopleFilters(workspaceId, query)

    // Group people by a metadata field value within optional geo filters.
    const buckets = await queryPeopleHistogram(sql, filters, metadataFieldKey(query.field))

    return {
      field: query.field,
      buckets,
    }
  },
  {
    query: histogramQuerySchema,
  },
)
