import {readdirSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {getSql} from '../src/db/client'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../migrations')

/**
 * Applies pending SQL migrations in lexical order.
 */
async function migrate(): Promise<void> {
  const sql = getSql()

  // Ensure the migration ledger table exists before reading applied versions.
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  // Load already-applied migration versions from the ledger.
  const appliedRows = await sql<{version: string}[]>`SELECT version FROM schema_migrations`
  const applied = new Set(appliedRows.map(row => row.version))

  // Discover migration files on disk in stable sorted order.
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      continue
    }

    const contents = readFileSync(join(migrationsDir, file), 'utf8')

    // Run each migration file atomically and record its version.
    await sql.begin(async tx => {
      await tx.unsafe(contents)
      await tx`INSERT INTO schema_migrations (version) VALUES (${file})`
    })

    console.log(`applied migration ${file}`)
  }

  await sql.end()
}

await migrate()
