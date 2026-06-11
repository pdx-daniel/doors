import postgres from 'postgres'

/** postgres.js client type alias used by repository modules. */
export type SqlClient = ReturnType<typeof postgres>

/** Shared postgres.js client configured from DATABASE_URL. */
let sqlInstance: SqlClient | undefined

/**
 * Returns a singleton postgres.js client.
 * @throws When DATABASE_URL is not set.
 */
export function getSql(): SqlClient {
  if (sqlInstance) {
    return sqlInstance
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required (see .env.example)')
  }

  // Create a postgres.js pool with sane defaults for local development.
  // postgres.js option names use snake_case at the driver boundary.
  sqlInstance = postgres(databaseUrl, {
    max: 10,
    // biome-ignore lint/style/useNamingConvention: postgres.js driver option name
    idle_timeout: 20,
    // biome-ignore lint/style/useNamingConvention: postgres.js driver option name
    connect_timeout: 10,
  })

  return sqlInstance
}

/**
 * Closes the shared postgres.js pool when present.
 */
export async function closeSql(): Promise<void> {
  if (!sqlInstance) {
    return
  }

  await sqlInstance.end()
  sqlInstance = undefined
}
