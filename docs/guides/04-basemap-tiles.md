# Basemap Tiles

This guide explains how basemap tiles work in the doors monorepo: generating local PMTiles archives with Planetiler, how they are served in development and production, and how to swap regions or customize styles.

## Overview

The app uses **local PMTiles archives** as its primary vector tile source. A PMTiles file is a single-file archive that contains all the vector tiles for a geographic region, served over HTTP with range requests. MapLibre reads tiles directly from the archive via the `pmtiles://` protocol.

The basemap pipeline works as follows:

```
Planetiler (Docker)  -->  basemap.pmtiles  -->  public/basemaps/  -->  MapLibre (pmtiles://)
```

When local tiles are unavailable (missing file, network error, 404), the map automatically falls back to **OpenFreeMap remote styles**, so the app never crashes on a failed tile load.

## Generating Tiles with Planetiler

[Planetiler](https://github.com/onthegomap/planetiler) generates vector tiles from OpenStreetMap data. The project wraps it in a Makefile target.

### Prerequisites

- Docker (Planetiler runs in a container)
- At least 4 GB of RAM available to Docker (more for larger regions)

### Command

```bash
bun run basemap:refresh
```

This runs the `basemap-refresh` Make target, which:

1. Creates `data/planetiler/` (download cache) and `apps/mobile/public/basemaps/` if they do not exist.
2. Starts a Planetiler Docker container that downloads the latest OSM extract for the configured area, processes it into vector tiles, and writes `basemap.pmtiles` to the `/data` volume mount (`data/planetiler/`).
3. Copies the resulting `basemap.pmtiles` into `apps/mobile/public/basemaps/` so the web dev server and production build can serve it.

### Default area

The default region is **Oregon** (set via `PLANETILER_AREA ?= oregon` in the Makefile). This corresponds to a Geofabrik extract name.

### Memory

By default Planetiler gets 4 GB of heap (`PLANETILER_RAM ?= 4g`). For larger regions (countries, continents), increase this:

```bash
make basemap-refresh PLANETILER_RAM=8g
```

## Changing the Region

Override `PLANETILER_AREA` with any Geofabrik extract name. The area name must match a [Geofabrik download](https://download.geofabrik.de/) path segment.

### Examples

```bash
# European micro-state (good for testing — fast, small file)
make basemap-refresh PLANETILER_AREA=monaco

# US state
make basemap-refresh PLANETILER_AREA=oregon

# Another US state
make basemap-refresh PLANETILER_AREA=massachusetts

# Whole country
make basemap-refresh PLANETILER_AREA=andorra

# Sub-region (use the slash notation Geofabrik uses)
make basemap-refresh PLANETILER_AREA="us/california"

# Continent-scale (requires significant RAM and disk)
make basemap-refresh PLANETILER_AREA="europe" PLANETILER_RAM=32g
```

### How area names map to Geofabrik

Planetiler resolves area names against the Geofabrik index. For a full list of valid names, see the [Planetiler documentation](https://github.com/onthegomap/planetiler#downloading-extracts) or inspect the [Geofabrik download page](https://download.geofabrik.de/).

Common patterns:

| Area name | Geofabrik path | Size |
|-----------|---------------|------|
| `monaco` | europe/monaco | ~2 MB |
| `andorra` | europe/andorra | ~5 MB |
| `oregon` | north-america/us/oregon | ~200 MB |
| `us/california` | north-america/us/california | ~1.5 GB |
| `germany` | europe/germany | ~3 GB |

### What happens to the old tiles

The copy step overwrites `apps/mobile/public/basemaps/basemap.pmtiles`. There is only ever one active basemap file. The source archive in `data/planetiler/` is also overwritten on the next run.

## How Tiles Are Served

### Development

**Web (webpack dev server):** The dev server is configured to serve the `apps/mobile/public/` directory as static content (see `webpack.config.js` `devServer.static.directory`). The PMTiles file at `public/basemaps/basemap.pmtiles` is therefore available at:

```
http://localhost:3001/basemaps/basemap.pmtiles
```

**Native (iOS/Android simulators):** In phase 1, native simulators load tiles from the host machine's webpack dev server. The URL is hard-coded as `http://localhost:3001` in the `WEB_DEV_SERVER_ORIGIN` constant. The app constructs a URL pointing back to the host:

- Web: `pmtiles://${window.location.origin}/basemaps/basemap.pmtiles`
- Native: `pmtiles://http://localhost:3001/basemaps/basemap.pmtiles`

### Production (web)

The webpack production build uses `CopyWebpackPlugin` to copy `public/basemaps/` into `web-dist/basemaps/`. The PMTiles file is deployed alongside the rest of the web app. The app reads tiles from the same origin:

```
pmtiles://${window.location.origin}/basemaps/basemap.pmtiles
```

### Production (native — future)

Phase 2 will bundle the PMTiles file as a native device asset and return a `file://` URL instead of the dev server host. This guide will be updated when that work is complete.

### PMTiles protocol handler

On web, the `pmtiles://` protocol is registered with MapLibre in `registerPmtilesProtocol.ts` using the `pmtiles` npm package's `Protocol` class. This translates MapLibre's tile requests into HTTP range requests against the PMTiles file. The registration happens once per page load.

On native (`@maplibre/maplibre-react-native` v11), the `pmtiles://` protocol is built-in and requires no additional setup.

## Style Files

The app ships two OpenMapTiles-compatible style files as committed JSON assets:

| File | Appearance | Source |
|------|-----------|--------|
| `apps/mobile/src/assets/liberty.style.json` | Light | OpenMapTiles Liberty variant |
| `apps/mobile/src/assets/dark.style.json` | Dark | OpenMapTiles Dark variant |

These are **base styles** that define:

- **Paint properties** — colors, opacity, text size for every map layer (roads, buildings, water, labels, etc.)
- **Sprites and glyphs** — loaded from the OpenFreeMap CDN (remote URLs for marker icons and font glyphs)
- **Source placeholder** — both styles declare an `openmaptiles` source of type `vector` with a placeholder URL that gets replaced at runtime

### How styles are applied

The `buildBasemapStyle()` function in `apps/mobile/src/lib/basemapStyle.ts`:

1. Selects the light or dark base style based on the current `MapAppearance`.
2. Deep-clones the base style via `structuredClone()`.
3. Overwrites the `openmaptiles` source's `url` property with the `pmtiles://` URL pointing to the local archive.

```ts
style.sources = {
  ...style.sources,
  openmaptiles: {
    type: 'vector',
    url: pmtilesUrl,
  },
}
```

Sprites and glyphs continue to load from the OpenFreeMap CDN as defined in the base style — these are not bundled locally.

## Fallback Behavior

When the local PMTiles file cannot be loaded, the app gracefully degrades to remote styles served by [OpenFreeMap](https://openfreemap.org/).

### Detection

On web, the `MapView.web.tsx` component listens for MapLibre `error` events and checks whether the error is basemap-related via `isBasemapLoadError()`. This function looks for:

- `sourceId` containing `"openmaptiles"`
- Error messages containing `"pmtiles"`, `"Failed to load"`, or `"404"`

On native, the `onDidFailLoadingMap` callback on the `MapLibreMap` component triggers the same fallback.

### Switching to remote

The `useMapViewModel` hook tracks a `fallbackUsed` boolean state. Once set:

1. `getBasemapStyle()` returns a remote OpenFreeMap style URL instead of building a local PMTiles style.
2. The map calls `map.setStyle(getRemoteFallbackStyleUrl(appearance))` on web, or passes the remote URL as `mapStyle` on native.

### Remote style URLs

| Appearance | URL |
|-----------|-----|
| Light | `https://tiles.openfreemap.org/styles/liberty` |
| Dark | `https://tiles.openfreemap.org/styles/dark` |

The fallback is permanent for the session — once activated, the map does not retry the local PMTiles file.

## Swapping or Customizing Styles

### Replacing the base style

1. Obtain (or author) a new OpenMapTiles-compatible style JSON.
2. Place it in `apps/mobile/src/assets/`.
3. Import it in `apps/mobile/src/lib/basemapStyle.ts` and add it to the appearance switch.
4. Update the `MapAppearance` type in `apps/mobile/src/constants/map.ts` if adding a new variant.

Any style used as a base style **must** define an `openmaptiles` vector source — the `buildBasemapStyle()` function overwrites only its `url` property. The source type must remain `"vector"`.

### Customizing paint rules

Edit `liberty.style.json` or `dark.style.json` directly. These files are committed to the repository and version-controlled. Changes take effect on rebuild — no tile regeneration is needed because paint rules are client-side.

### Changing sprite or glyph sources

The base styles reference OpenFreeMap CDN URLs for sprites and glyphs. To use a different provider or self-hosted assets:

1. Update the `sprite` and `glyphs` fields in both style JSON files.
2. Ensure the new provider serves assets compatible with the OpenMapTiles schema at the zoom levels your style requires.

## Adding a New Region

To generate tiles for a different area:

1. Run the refresh command with the desired area name:
   ```bash
   make basemap-refresh PLANETILER_AREA=monaco
   ```
2. Restart the web dev server so it picks up the new `basemap.pmtiles` file.
3. Verify the map renders correctly at the expected coordinates for that region.

You may also want to update the default map center in `apps/mobile/src/constants/map.ts` if the new region has a different focus area. The `DEFAULT_CENTER` is set to Portland, OR (`[-122.677379, 45.523461]`) and `DEFAULT_ZOOM` is 12.

## Removing the Basemap

If you delete `apps/mobile/public/basemaps/basemap.pmtiles`, the app will use OpenFreeMap remote tiles exclusively. The fallback logic activates when the PMTiles file is missing (HTTP 404), so the map continues to work with full functionality — just without local tiles.

This can be useful during development when you do not want to wait for tile generation.

## Troubleshooting

### Tiles not loading (blank map)

1. Check that `apps/mobile/public/basemaps/basemap.pmtiles` exists and is not empty.
2. Verify the file is accessible via the dev server: open `http://localhost:3001/basemaps/basemap.pmtiles` in a browser. The browser should prompt to download a file (or display binary content in the network tab).
3. Check the browser developer console for 404 or CORS errors.
4. On native, ensure the webpack dev server is running on port 3001 and the simulator can reach the host machine.

### Out of memory during Planetiler run

Planetiler fails with Java heap space errors. Increase available RAM:

```bash
make basemap-refresh PLANETILER_RAM=8g
```

If you are still hitting limits, the area may be too large for your machine. Try a smaller extract (e.g., a city or state instead of a whole country).

### Planetiler download fails

- Ensure Docker is running and can pull images from `ghcr.io`.
- The Geofabrik download server may be temporarily unavailable. Wait and retry.
- Check that `PLANETILER_AREA` matches a valid Geofabrik extract name. Invalid names produce a download error.

### "pmtiles://" protocol not recognized

- On web, verify that `registerPmtilesProtocol()` is called before MapLibre initializes (it runs in the `useEffect` in `MapView.web.tsx`).
- On native, update `@maplibre/maplibre-react-native` to a version that supports `pmtiles://` (v11+).

### Fallback not activating

- Check the `isBasemapLoadError()` function if error event shapes have changed in a MapLibre update.
- On native, ensure `onDidFailLoadingMap` is wired to `onBasemapFailure`.

### Style errors after swapping regions

Style files are region-agnostic — they do not contain tile data. If the map fails to render after changing regions, the issue is likely with tile generation, not styles. Re-run `bun run basemap:refresh` for the new region.

### Webpack production build missing tiles

Verify that `CopyWebpackPlugin` in `webpack.config.js` includes the `basemaps` pattern with `noErrorOnMissing: true`. If the PMTiles file is absent during the build, webpack will emit a warning but not fail. Run `bun run basemap:refresh` before the production build if you want local tiles included.
