# Doors

A workspace-scoped people-location mapping application. Map your people and places across mobile and web from a single codebase.

## Stack

| Layer | Technology |
|-------|------------|
| API | [Elysia](https://elysiajs.com/) on [Bun](https://bun.sh) |
| Database | PostGIS 16 (Docker) |
| Mobile | React Native 0.80 + [NativeWind](https://www.nativewind.dev/) |
| Web | [react-native-web](https://necolas.github.io/react-native-web/) via Webpack |
| Map | [MapLibre GL JS](https://maplibre.org/) / [MapLibre RN](https://github.com/maplibre/maplibre-react-native) |
| Client SDK | [Eden Treaty](https://elysiajs.com/eden/treaty.html) — fully typed, auto-generated |
| Basemap | [Planetiler](https://github.com/onthegomap/planetiler) → PMTiles |
| Quality | [Biome](https://biomejs.dev/) (format + lint) + TypeScript |

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.2
- Docker Desktop (for PostGIS)

## Quick start

```bash
cp .env.example .env      # configure database credentials
bun install               # install all dependencies
bun run db:up             # start PostGIS
bun run db:migrate        # apply SQL migrations
bun run db:seed           # load Portland dev data
```

### Run the API

```bash
bun run dev:server        # http://localhost:3000
```

### Run the mobile / web app

```bash
bun run dev:mobile        # Metro bundler (for iOS/Android)
bun run dev:web           # Webpack dev server → http://localhost:3001
bun run ios               # launch iOS simulator
```

### Basemap tiles (optional)

```bash
bun run basemap:refresh   # generate Oregon PMTiles via Planetiler Docker
```

## Project structure

```
doors/
├── apps/
│   ├── server/           # Elysia API — routes, middleware, DB queries
│   └── mobile/           # React Native app (iOS/Android/Web)
├── packages/
│   └── api/              # Eden Treaty client & shared type schemas
├── data/                 # Planetiler output (gitignored)
├── docker-compose.yml    # PostGIS service
├── biome.json            # Lint + format config
└── tsconfig.base.json    # Shared TypeScript config
```

### API routes

All data routes are versioned under `/v1` and require the `X-Workspace-Id` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health |
| `GET` | `/v1/locations` | List locations |
| `GET` | `/v1/people` | List people |
| `GET` | `/v1/map/people` | GeoJSON FeatureCollection for map viewport |
| `GET` | `/v1/stats/*` | Histogram stats (location type, etc.) |

## Development

```bash
bun run check             # format + lint + safe fixes
bun run typecheck         # TypeScript across all workspaces
bun run ci                # read-only Biome check (CI)
```

## Database

- `bun run db:up` / `bun run db:down` — start/stop PostGIS
- `bun run db:migrate` — run SQL migrations
- `bun run db:seed` — seed Portland sample data
- `bun run db:reseed` — clear dev workspace data and reseed

The seeded workspace ID is exported as `DEV_WORKSPACE_ID` from `@doors/api`.
