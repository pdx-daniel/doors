# Local setup

This guide walks through bootstrapping the doors monorepo for local development. By the end you will have the API server, a database with seeded data, and the web or iOS app running on your machine.

---

## 1. Prerequisites

Before you start, install these tools:

| Tool | Version | Purpose |
|------|---------|---------|
| [Bun](https://bun.sh) | >= 1.2 | JavaScript runtime, package manager, and task runner |
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | Latest | PostGIS 16 database container |
| [Xcode](https://developer.apple.com/xcode/) (macOS) | >= 16 | iOS simulator and native builds |
| [Android Studio](https://developer.android.com/studio) (optional) | Latest | Android emulator and builds |

**Verify installations:**

```bash
bun --version
docker --version
```

> Bun handles all package management and script execution. You do **not** need Node.js, npm, Yarn, or pnpm installed separately.

---

## 2. Clone and install

```bash
git clone <repository-url> doors
cd doors
bun install
```

`bun install` resolves dependencies across all workspaces (`apps/*`, `packages/*`) using the version catalog defined in the root `package.json`. No separate install steps are needed per package.

---

## 3. Environment configuration

Copy the example environment file:

```bash
cp .env.example .env
```

The resulting `.env` file contains these variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://doors:doors@localhost:5432/doors` | PostgreSQL connection string. The credentials and database name match the `docker-compose.yml` defaults. |
| `PORT` | `3000` | Port the API server listens on. Change if port 3000 is already in use. |
| `DOORS_API_URL` | *(optional)* | Overrides the API base URL used by the web and mobile clients. Defaults to `http://localhost:3000`. |

The `.env` file is gitignored. It is read automatically by the server's `dev` and `start` scripts (`--env-file=../../.env`).

---

## 4. Database

The project uses **PostGIS 16** running inside a Docker container for local development.

### 4.1 Start PostGIS

```bash
bun run db:up
```

This runs `docker compose up -d db`, which starts the `db` service defined in `docker-compose.yml`:

- Image: `postgis/postgis:16-3.4`
- Host port: `5432` (maps to container port `5432`)
- User / password / database: `doors` / `doors` / `doors`
- Data volume: `doors_pgdata` (persists across restarts)

Docker will pull the image on first run. A health check ensures the container is ready before accepting connections.

Verify the container is running:

```bash
docker compose ps
```

You should see the `db` service with status `Up` and healthy.

### 4.2 Apply migrations

```bash
bun run db:migrate
```

This runs `apps/server/scripts/migrate.ts`, which:

1. Creates the `schema_migrations` ledger table if it does not exist.
2. Reads `.sql` files from `apps/server/migrations/` in sorted order.
3. Applies any migration that has not yet been recorded in the ledger.

The initial migration (`001_init.sql`) enables the PostGIS extension and creates the core tables:

- `workspaces` — tenant containers for people and location data
- `locations` — spatial points of interest (with a `geometry(Geometry, 4326)` column and a GIST index)
- `people` — individuals linked to a location (with a `JSONB` metadata column)
- `person_links` — external identity mappings scoped to a workspace

The script creates a `search_vector` column on `locations` and `people` using `tsvector` for full-text search.

### 4.3 Seed dev data

```bash
bun run db:seed
```

This runs `apps/server/scripts/seed.ts`, which:

1. Clears any previously seeded data from the dev workspace.
2. Creates the development workspace (`id: 01900000-0000-7000-8000-000000000001`, name: "Doors Dev").
3. Inserts 20 Portland-area venues as locations (offices, cafes, community centers, parks, etc.).
4. Creates approximately 62 people distributed across those venues, with some people getting their own nearby micro-locations offset from the venue pin.
5. Attaches external links to the first few people.

The output looks like:

```
seeded 20 venues, 8 nearby spots, and 62 people
```

### 4.4 Reset seeded data

```bash
bun run db:reseed
```

This is an alias for `db:seed` with the same clearing behavior — it deletes all dev workspace data and re-inserts from scratch. It is safe to run at any time during development.

> Note: `db:reseed` operates **only** on data belonging to the dev workspace (`DEV_WORKSPACE_ID`). It does not affect other workspaces.

### 4.5 Stop the database

```bash
bun run db:down
```

Stops and removes the Docker container. The `doors_pgdata` volume persists so data survives restarts.

---

## 5. Running the API server

Start the Elysia API server with hot reload:

```bash
bun run dev:server
```

This runs `bun --watch src/index.ts` inside `apps/server`. The server:

- Reads `DATABASE_URL` and `PORT` from `.env`
- Starts on `http://localhost:3000` (or the port specified in `PORT`)
- Watches source files and restarts automatically on changes

**Verify the server is running:**

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"ok":true,"service":"doors"}
```

### API routes

All data routes are versioned under `/v1` and require a workspace scope via the `X-Workspace-Id` header:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/v1/locations` | List locations for the current workspace |
| `GET` | `/v1/people` | List people for the current workspace |
| `GET` | `/v1/map/people` | GeoJSON FeatureCollection for map viewport queries |
| `GET` | `/v1/stats/*` | Histogram statistics (location type, etc.) |

The Eden Treaty client in `@doors/api` automatically sends the `X-Workspace-Id: 01900000-0000-7000-8000-000000000001` header with every request.

---

## 6. Running the web app

The web app is built with `react-native-web` and bundled with Webpack.

```bash
bun run dev:web
```

This starts a Webpack dev server on `http://localhost:3001` with hot module replacement. It serves the same React Native codebase configured for web rendering.

The web app uses the same components as iOS/Android, with platform-specific files only where needed (e.g., `MapView.web.tsx` vs `MapView.native.tsx`).

> Make sure the API server is running (step 5) before opening the web app. The web client fetches data from `http://localhost:3000` by default.

---

## 7. Running the iOS app

Running on iOS requires two terminal sessions: one for the Metro bundler and one for the native build.

### 7.1 Start the Metro bundler

```bash
bun run dev:mobile
```

This starts the React Native Metro bundler on its default port (`8081`). It serves the JavaScript bundle to the simulator. Keep this terminal running.

### 7.2 Launch the iOS simulator

In a separate terminal:

```bash
bun run ios
```

This runs `react-native run-ios`, which:

1. Builds the native iOS project (if needed).
2. Opens the iOS simulator.
3. Connects to the running Metro bundler.

The app will load and render the same codebase used by the web target.

> **Prerequisites:** Xcode must be installed, and you must have run `bun install` at the repo root. The first native build may take several minutes. If the simulator does not appear, ensure no other Metro instance is running on port 8081.

---

## 8. Command reference

| Command | Target | What it does |
|---------|--------|--------------|
| `bun run db:up` | Database | Start PostGIS container via Docker Compose |
| `bun run db:down` | Database | Stop and remove PostGIS container |
| `bun run db:migrate` | Database | Apply pending SQL migrations |
| `bun run db:seed` | Database | Seed Portland dev data (clears first) |
| `bun run db:reseed` | Database | Clear dev data and re-seed (alias for `db:seed`) |
| `bun run dev:server` | API | Start Elysia server on :3000 with hot reload |
| `bun run dev:mobile` | Mobile | Start Metro bundler for iOS/Android dev |
| `bun run dev:web` | Web | Start Webpack dev server on :3001 |
| `bun run ios` | Mobile | Build and launch iOS simulator |
| `bun run android` | Mobile | Build and launch Android emulator |
| `bun run typecheck` | All | TypeScript type checking across all workspaces |
| `bun run check` | All | Biome format + lint + safe auto-fixes |
| `bun run check:unsafe` | All | Same as `check` plus unsafe fixes |
| `bun run ci` | All | Read-only Biome check (used in CI) |
| `bun run basemap:refresh` | Data | Generate Oregon PMTiles via Planetiler Docker |

---

## 9. Verification

After completing the steps above, verify everything is working:

1. **Database is running:** `docker compose ps` shows `db` as `Up (healthy)`.
2. **Migrations applied:** No errors from `bun run db:migrate`. Running it again produces no output (all migrations already applied).
3. **Seed data loaded:** `bun run db:seed` reports the venue and person counts.
4. **API responds:** `curl http://localhost:3000/health` returns `{"ok":true,"service":"doors"}`.
5. **API returns data:** Make an authenticated request:

   ```bash
   curl -H "X-Workspace-Id: 01900000-0000-7000-8000-000000000001" \
     http://localhost:3000/v1/people | head -c 500
   ```

   You should see a JSON array of seeded people with their display names, emails, and location references.

6. **Web app renders:** Open `http://localhost:3001` in a browser. The map should display Portland-area pins from the seeded data.

---

## 10. Troubleshooting

### Docker is not running

```text
Cannot connect to the Docker daemon
```

Open Docker Desktop or run:

```bash
open -a Docker
```

Wait for the Docker daemon to be ready, then retry `bun run db:up`.

### Port 5432 already in use

If another Postgres instance is already running on port 5432, either stop it or change the host port in `docker-compose.yml`:

```yaml
ports:
  - '5433:5432'   # map host 5433 to container 5432
```

Then update `DATABASE_URL` in `.env` accordingly:

```
DATABASE_URL=postgres://doors:doors@localhost:5433/doors
```

### Port 3000 already in use

Set a different port in `.env`:

```
PORT=3005
```

The server will start on the new port. Update `DOORS_API_URL` in `.env` if the web/mobile clients need to point to the custom port.

### Bundler conflicts (Metro)

If you see errors about an existing Metro instance on port 8081:

```bash
# Kill any existing Metro process
kill $(lsof -ti :8081)

# Then restart
bun run dev:mobile
```

### iOS build fails

- Ensure Xcode is installed and you have accepted the license (`sudo xcodebuild -license accept`).
- Run `bun install` again if native dependencies have changed.
- If CocoaPods is missing, install it: `sudo gem install cocoapods`.
- If `pod install` fails inside `apps/mobile/ios`, navigate there and run `pod install` manually.

### Webpack build errors

If `bun run dev:web` fails, clear the Webpack cache:

```bash
rm -rf apps/mobile/node_modules/.cache
bun run dev:web
```

### TypeScript errors

```bash
bun run typecheck
```

Resolve any reported errors. The project uses strict TypeScript with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax`. Common issues:

- Missing explicit type annotations on exports (enforced by Biome).
- Importing types without `type` keyword (use `import type`).
- Using `require` instead of `import` (module system is ESM).

### Biome diagnostics

```bash
bun run check
```

Biome enforces formatting, lint rules, import ordering, naming conventions, and explicit return types. Most issues are auto-fixable with `bun run check` or `bun run check:unsafe`.

### Database connection refused

If `bun run db:migrate` fails with a connection error:

1. Verify Docker is running.
2. Check the container logs: `docker compose logs db`.
3. Ensure `DATABASE_URL` in `.env` matches `docker-compose.yml` exactly.
4. Wait a few seconds after `db:up` for the health check to pass, then retry.

### I want a different basemap region

The default basemap covers Oregon. To generate tiles for a different area:

```bash
make basemap-refresh PLANETILER_AREA=monaco
```

This runs Planetiler in Docker and produces a PMTiles file at `apps/mobile/public/basemaps/basemap.pmtiles`. See `Makefile` for details.
