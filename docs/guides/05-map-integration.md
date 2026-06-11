# Map integration

This guide covers the architecture and setup of MapLibre-based mapping across web and native in the doors monorepo. It is written for contributors adding or modifying map features.

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Web MapLibre setup](#2-web-maplibre-setup)
3. [Native MapLibre setup](#3-native-maplibre-setup)
4. [Shared view model pattern](#4-shared-view-model-pattern)
5. [People data layer](#5-people-data-layer)
6. [Viewport queries](#6-viewport-queries)
7. [Handling map interactions](#7-handling-map-interactions)
8. [Basemap fallback](#8-basemap-fallback)
9. [Adding a new layer](#9-adding-a-new-layer)
10. [App shell integration](#10-app-shell-integration)

---

## 1. Architecture overview

The mapping system has three runtime implementations, one shared view model hook, and one server endpoint.

### File layout

| File | Purpose |
|------|---------|
| `apps/mobile/src/components/MapView.tsx` | Fallback for unsupported platforms. Renders a plain text message. |
| `apps/mobile/src/components/MapView.web.tsx` | Web map using `maplibre-gl` v5 directly in a DOM container. |
| `apps/mobile/src/components/MapView.native.tsx` | Native map using `@maplibre/maplibre-react-native` v11. |
| `apps/mobile/src/hooks/useMapViewModel.ts` | Shared hook that drives both implementations. |
| `apps/mobile/src/hooks/useMapPeople.ts` | Debounced GeoJSON fetch for people in the current viewport. |
| `apps/mobile/src/lib/mapPeopleLayer.ts` | Layer IDs, paint properties, and filter constants for the people layer. |
| `apps/mobile/src/lib/basemapStyle.ts` | Constructs a `StyleSpecification` from local PMTiles and appearance. |
| `apps/mobile/src/lib/registerPmtilesProtocol.ts` | Web-only PMTiles protocol handler registration. |
| `apps/mobile/src/lib/logMapPersonFeature.ts` | Logs person/cluster/stack metadata on press. |
| `apps/mobile/src/constants/map.ts` | Constants for default center, zoom, style URLs, and PMTiles paths. |
| `apps/server/src/routes/map.ts` | `GET /v1/map/people` returning GeoJSON clusters or stacks. |

### Platform resolution

Webpack resolves `@/components/MapView` to `MapView.web.tsx` via an alias in `webpack.config.js`:

```js
alias: {
  [path.join(appRoot, 'src/components/MapView')]: path.join(
    appRoot,
    'src/components/MapView.web.tsx',
  ),
}
```

React Native's Metro resolver uses the `.native.tsx` extension convention automatically. The fallback `MapView.tsx` provides a stub for any other platform. Consumers import from `@/components/MapView` and never reference the platform suffix.

### Data flow

```
map movement (pan/zoom)
       |
       v
  viewport state  ──> useMapPeople ──> GET /v1/map/people?bbox=...&zoom=...
  (west, south,                                          |
   east, north, zoom)                                    v
       ^                                          GeoJSON FeatureCollection
       |                                                |
       |                                                v
       |                                         MapLibre GeoJSON source
       |                                         (peopleData)
       |
       └── setViewport() ◄── moveend / onRegionDidChange
```

---

## 2. Web MapLibre setup

`MapView.web.tsx` uses `maplibre-gl` directly with an imperative API. The map mounts into a plain `<View>` whose native DOM element becomes the MapLibre container.

### Initialization

```tsx
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export function MapView(): ReactElement {
  const hostRef = useRef<View>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    const hostElement = hostRef.current as unknown as HTMLDivElement | null
    if (!hostElement || mapRef.current) return

    registerPmtilesProtocol()

    const basemapStyle = buildBasemapStyle(getBasemapPmtilesUrl(), appearance)

    const map = new maplibregl.Map({
      container: hostElement,
      style: basemapStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return <View ref={hostRef} style={styles.map} />
}
```

### PMTiles protocol

PMTiles archives (`pmtiles://`) do not work out of the box with maplibre-gl v5 on web. The `registerPmtilesProtocol()` function wires the `pmtiles` protocol into MapLibre's custom protocol API:

```ts
// apps/mobile/src/lib/registerPmtilesProtocol.ts
const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)
```

This call is safe to repeat — it guards against double registration with a module-level `protocolRegistered` flag.

### Key events on web

| Event | Handler | Purpose |
|-------|---------|---------|
| `map.on('error', ...)` | `isBasemapLoadError()` check | Detects tile load failures and triggers fallback. |
| `map.once('load', ...)` | `syncViewport()`, `ensurePeopleLayer()` | Initial setup after style loads. |
| `map.on('moveend', ...)` | `syncViewport()` | Fires viewport bounds/zoom into the shared hook. |
| `map.on('click', ...)` | `map.queryRenderedFeatures()` | Queries people features at the click point. |
| `map.on('mouseenter', PEOPLE_CIRCLE_LAYER_ID, ...)` | Set cursor to pointer | Hover feedback on people dots. |
| `map.on('mouseleave', PEOPLE_CIRCLE_LAYER_ID, ...)` | Clear cursor | Restore default cursor. |

### Appearance change

When the `appearance` prop changes, `map.setStyle()` is called with either the local PMTiles style or the remote fallback. After the style reloads (`map.once('load')`), the people layer is re-added because `setStyle()` destroys all existing sources and layers.

```tsx
useEffect(() => {
  if (!map?.isStyleLoaded()) return
  if (previousAppearance === appearance) return

  const nextStyle = fallbackUsed
    ? getRemoteFallbackStyleUrl(appearance)
    : buildBasemapStyle(getBasemapPmtilesUrl(), appearance)

  map.setStyle(nextStyle)
  map.once('load', () => {
    ensurePeopleLayer(map)
  })
}, [appearance])
```

### Cleanup

The effect return removes the map instance and nulls the ref:

```ts
return () => {
  map.remove()
  mapRef.current = null
}
```

---

## 3. Native MapLibre setup

`MapView.native.tsx` uses `@maplibre/maplibre-react-native` v11 with a declarative component API.

### Component tree

```tsx
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MaplibreMap,
} from '@maplibre/maplibre-react-native'

<View style={styles.container}>
  <MaplibreMap
    mapStyle={mapStyle}
    onDidFailLoadingMap={onBasemapFailure}
    onRegionDidChange={handleRegionDidChange}
    style={styles.map}>
    <Camera
      initialViewState={{
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      }}
    />
    {/* People layers rendered conditionally */}
    {peopleEnabled ? (
      <GeoJSONSource id={PEOPLE_SOURCE_ID} data={peopleData} onPress={handlePeoplePress}>
        <Layer id={PEOPLE_CIRCLE_LAYER_ID} ... />
        <Layer id={PEOPLE_COUNT_LAYER_ID} ... />
      </GeoJSONSource>
    ) : null}
  </MaplibreMap>
</View>
```

### Key differences from web

| Aspect | Web (`maplibre-gl`) | Native (`@maplibre/maplibre-react-native`) |
|--------|---------------------|--------------------------------------------|
| API style | Imperative (methods on `maplibregl.Map`) | Declarative (JSX components) |
| Style | `map.setStyle(url)` prop on `mapStyle` prop | `mapStyle` prop on `<MaplibreMap>` |
| Camera | `map.setCenter()`, `map.setZoom()` | `<Camera>` component |
| Sources/Layers | `map.addSource()`, `map.addLayer()` | `<GeoJSONSource>`, `<Layer>` children |
| Press handling | `map.queryRenderedFeatures()` | `onPress` prop on `<GeoJSONSource>` |
| Basemap failure | `map.on('error', ...)` with heuristics | `onDidFailLoadingMap` prop |
| Viewport change | `map.on('moveend', ...)` | `onRegionDidChange` prop |
| PMTiles | Custom protocol via `registerPmtilesProtocol()` | Built-in `pmtiles://` support |

### Viewport events on native

The `onRegionDidChange` event provides a `bounds` array in `[west, south, east, north]` order:

```ts
const handleRegionDidChange = useCallback(
  (event: NativeSyntheticEvent<ViewStateChangeEvent>): void => {
    const {bounds, zoom} = event.nativeEvent
    const [west, south, east, north] = bounds
    setViewport({west, south, east, north, zoom})
  },
  [setViewport],
)
```

### Conditional rendering of people layer

The native version conditionally renders the entire `<GeoJSONSource>` subtree. When `peopleEnabled` is `false`, the components are not mounted, avoiding unnecessary native work:

```tsx
{peopleEnabled ? (
  <GeoJSONSource id={PEOPLE_SOURCE_ID} data={peopleData} onPress={handlePeoplePress}>
    <Layer ... />
    <Layer ... />
  </GeoJSONSource>
) : null}
```

---

## 4. Shared view model pattern

The `useMapViewModel` hook (`apps/mobile/src/hooks/useMapViewModel.ts`) is the single source of truth for both web and native `MapView` implementations.

### Return type

```ts
export type MapViewModel = {
  appearance: MapAppearance        // 'light' | 'dark'
  viewport: MapViewport | null      // Current bounds + zoom
  setViewport: (viewport: MapViewport) => void
  peopleData: GeoJsonFeatureCollection
  peopleEnabled: boolean
  mapStyle: string | StyleSpecification  // Computed from appearance + fallback state
  onBasemapFailure: () => void
  onPeoplePress: (properties: unknown) => void
}
```

### Internal wiring

```ts
export function useMapViewModel(): MapViewModel {
  const appearance = useMapAppearance()
  const apiHealth = useApiHealth()
  const peopleEnabled = apiHealth === 'ok'
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const {data: peopleData} = useMapPeople(viewport, peopleEnabled)

  const mapStyle = useMemo(() => {
    if (fallbackUsed) {
      return getRemoteFallbackStyleUrl(appearance)
    }
    return buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
  }, [appearance, fallbackUsed])

  const onBasemapFailure = useCallback(() => {
    setFallbackUsed(prev => prev ? prev : true)
  }, [])

  const onPeoplePress = useCallback((properties: unknown) => {
    logMapPersonFeature(properties)
  }, [])

  return { appearance, viewport, setViewport, peopleData, peopleEnabled, mapStyle, onBasemapFailure, onPeoplePress }
}
```

### Design notes

- **Avoiding duplicate state**: The map implementations call `setViewport`, which triggers `useMapPeople` to re-fetch. The map does not own the data; the hook does.
- **Appearance as a hook**: `useMapAppearance()` reads the system color scheme via `useColorScheme()` and normalizes it to `'light'` or `'dark'`. The hook is called independently inside `AppShell` (for the attribution style) and `useMapViewModel` (for basemap selection).
- **Fallback is a one-way latch**: `setFallbackUsed(true)` is idempotent — once set, the remote style URL is used for the rest of the session (including appearance switches).
- **No exceptions**: `useMapPeople` catches all errors and returns an empty collection, so the map never crashes on network failure.

---

## 5. People data layer

The people layer shows person dots on the map, aggregated into geohash clusters at low zoom and visual-group stacks at high zoom.

### Layer constants (`apps/mobile/src/lib/mapPeopleLayer.ts`)

```ts
export const PEOPLE_SOURCE_ID = 'doors-people'
export const PEOPLE_CIRCLE_LAYER_ID = 'doors-people-circles'
export const PEOPLE_COUNT_LAYER_ID = 'doors-people-counts'
```

### Circle paint (`peopleCirclePaint`)

The circle radius and color are data-driven using MapLibre expression syntax:

| Condition | Radius | Color |
|-----------|--------|-------|
| `cluster === true` | Interpolated from 12 to 28 px based on `count` (1–100+) | `#1d4ed8` |
| `count > 1` (stack) | Interpolated from 10 to 22 px based on `count` (2–20) | `#1e40af` |
| Single person (else) | 6 px | `#2563eb` |

All circles have a 1 px white stroke for contrast.

### Count label layer (`peopleCountLayout`)

The symbol layer renders a numeric badge on circles where `count > 1`:

```ts
export const peopleCountFilter: FilterSpecification = ['>', ['get', 'count'], 1]

export const peopleCountLayout = {
  'text-field': ['to-string', ['get', 'count']],
  'text-size': 11,
  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
  'text-allow-overlap': true,
  'text-ignore-placement': true,
}
```

The `text-allow-overlap` and `text-ignore-placement` flags ensure all counts are visible even when dots are densely packed.

### GeoJSON source shape

The server returns a FeatureCollection where each feature's properties include:

```ts
// Single person
{ personId: string, displayName: string, email?: string, ... }

// Visual group stack (stacked === true)
{ stacked: true, count: number, locationId: string, locationName: string, ... }

// Geohash cluster (cluster === true)
{ cluster: true, count: number, geohash: string, ... }
```

### Adding the layer on web

```ts
function ensurePeopleLayer(map: maplibregl.Map): void {
  const existingSource = map.getSource(PEOPLE_SOURCE_ID)

  if (!existingSource) {
    map.addSource(PEOPLE_SOURCE_ID, { type: 'geojson', data: peopleData })
    map.addLayer({ id: PEOPLE_CIRCLE_LAYER_ID, type: 'circle', source: PEOPLE_SOURCE_ID, paint: peopleCirclePaint })
    map.addLayer({ id: PEOPLE_COUNT_LAYER_ID, type: 'symbol', source: PEOPLE_SOURCE_ID, filter: peopleCountFilter, layout: peopleCountLayout, paint: peopleCountPaint })
    return
  }

  // Update existing source data in place
  const source = existingSource as maplibregl.GeoJSONSource
  source.setData(peopleData)
}
```

### Adding the layer on native

The native version nests `<Layer>` components inside `<GeoJSONSource>`:

```tsx
<GeoJSONSource id={PEOPLE_SOURCE_ID} data={peopleData} onPress={handlePeoplePress}>
  <Layer id={PEOPLE_CIRCLE_LAYER_ID} type="circle" paint={peopleCirclePaint} />
  <Layer id={PEOPLE_COUNT_LAYER_ID} type="symbol" filter={peopleCountFilter} layout={peopleCountLayout} paint={peopleCountPaint} />
</GeoJSONSource>
```

### Removing the layer

On web, a dedicated `removePeopleLayer()` function removes the count layer first (z-order requires reverse removal), then the circle layer, then the source. On native, conditional rendering handles this — when `peopleEnabled` is `false`, the `<GeoJSONSource>` subtree unmounts.

### Clustering modes

The server endpoint accepts a `cluster` parameter with two modes:

| Mode | Behavior |
|------|----------|
| `'auto'` | Geohash precision is derived from the zoom level. Returns cluster features with aggregate counts. |
| `'false'` | Visual grouping at high zoom. Overlapping dots are merged into stacks when their screen positions would overlap, given the current zoom and latitude. |

The hook always sends `cluster: 'auto'`. The server handles the rest.

---

## 6. Viewport queries

Viewport state flows from the map through the shared hook to the API, and GeoJSON results flow back to the map.

### Flow

```
  map.moveend / onRegionDidChange
         |
         v
  setViewport({ west, south, east, north, zoom })
         |
         v
  useMapPeople(viewport, enabled)
         |
         v  (debounced 250ms)
  GET /v1/map/people?bbox=-122.7,45.5,-122.6,45.6&zoom=14&cluster=auto
         |
         v
  GeoJSON FeatureCollection
         |
         v
  source.setData(peopleData)  (web update in place)
  <GeoJSONSource data={peopleData}>  (native re-render)
```

### The `useMapPeople` hook

`apps/mobile/src/hooks/useMapPeople.ts` implements debounced fetching with stale-response guarding:

```ts
export function useMapPeople(viewport: MapViewport | null, enabled: boolean) {
  const [data, setData] = useState(EMPTY_FEATURE_COLLECTION)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!enabled || !viewport) return

    const requestId = ++requestIdRef.current

    const timer = setTimeout(() => {
      const bbox = [viewport.west, viewport.south, viewport.east, viewport.north].join(',')

      const {data: response, error} = await api.v1.map.people.get({
        query: { bbox, zoom: viewport.zoom, cluster: 'auto' },
      })

      // Ignore if a newer request has been issued
      if (requestIdRef.current !== requestId) return

      if (error || !isValidCollection(response)) {
        setData(EMPTY_FEATURE_COLLECTION)
        return
      }

      setData(response)
    }, 250)

    return () => clearTimeout(timer)
  }, [enabled, viewport])

  return { data }
}
```

Key behaviors:

- **Debounce**: 250 ms after the last viewport change before sending a request.
- **Stale guard**: Each request increments a counter. Stale responses (from a previous pan/zoom) are discarded.
- **Graceful failure**: Network errors, API errors, or invalid responses all resolve to an empty `FeatureCollection`.
- **Empty initial state**: Before the first successful fetch, `data` is `{ type: 'FeatureCollection', features: [] }`.

### Server route

`GET /v1/map/people` accepts:

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `bbox` | string | — | Comma-separated `west,south,east,north` |
| `zoom` | number | 12 | Current map zoom level |
| `cluster` | string | `'auto'` | `'auto'` for geohash, `'false'` for visual group |
| `q`, `filter`, `jsonpath`, `radius`, `polygon` | string | — | Additional filter parameters |

The response is always a GeoJSON FeatureCollection.

---

## 7. Handling map interactions

### People press (click/tap)

**Web**: `map.on('click', ...)` calls `map.queryRenderedFeatures(event.point, { layers: [PEOPLE_CIRCLE_LAYER_ID, PEOPLE_COUNT_LAYER_ID] })` and finds the first matching feature. The properties are passed to `onPeoplePress`.

**Native**: The `<GeoJSONSource onPress={handlePeoplePress}>` callback provides a `PressEventWithFeatures` native event. The first feature's properties are passed to `onPeoplePress`.

### Logging

`logMapPersonFeature(properties)` in `apps/mobile/src/lib/logMapPersonFeature.ts` distinguishes three feature types and logs contextually:

- **Cluster** (`cluster === true`): Logs count and geohash.
- **Stack** (`stacked === true && count > 1`): Logs count, location, and representative name.
- **Single person**: Logs full person details (id, name, email, phone, location, metadata).

### Cursor feedback (web only)

```ts
map.on('mouseenter', PEOPLE_CIRCLE_LAYER_ID, () => {
  map.getCanvas().style.cursor = 'pointer'
})

map.on('mouseleave', PEOPLE_CIRCLE_LAYER_ID, () => {
  map.getCanvas().style.cursor = ''
})
```

This changes the cursor to a pointer when hovering over any people dot, stack, or cluster.

---

## 8. Basemap fallback

Both implementations detect basemap load failures and switch to a remote OpenFreeMap style.

### Detection

**Web**: The `error` event fires for various tile and network errors. The heuristic `isBasemapLoadError()` checks:

```ts
function isBasemapLoadError(event: maplibregl.ErrorEvent): boolean {
  return (
    sourceId.includes('openmaptiles') ||
    message.includes('pmtiles') ||
    message.includes('Failed to load') ||
    message.includes('404')
  )
}
```

The first matching error triggers the fallback. A `fallbackUsedRef` ensures the switch happens only once.

**Native**: The `<MaplibreMap onDidFailLoadingMap={onBasemapFailure}>` prop fires directly when the style fails to load.

### Switch

The `onBasemapFailure` callback in `useMapViewModel` sets `fallbackUsed` to `true`. This causes the `mapStyle` memo to return the remote style URL:

```ts
const mapStyle = useMemo(() => {
  if (fallbackUsed) {
    return getRemoteFallbackStyleUrl(appearance)
  }
  return buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
}, [appearance, fallbackUsed])
```

On web, the early error event also calls `map.setStyle(getRemoteFallbackStyleUrl(...))` directly to switch the style inline. The native map picks up the new `mapStyle` prop on re-render.

### Fallback style URLs

```ts
// apps/mobile/src/constants/map.ts
export const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
export const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'
```

### Post-fallback appearance changes

When `fallbackUsed` is `true`, subsequent appearance switches use the remote URLs rather than attempting the local PMTiles again:

```ts
const nextStyle = fallbackUsedRef.current
  ? getRemoteFallbackStyleUrl(appearance)
  : buildBasemapStyle(getBasemapPmtilesUrl(), appearance)
map.setStyle(nextStyle)
```

---

## 9. Adding a new layer

To add a new data layer (e.g. "offices" or "events"), follow these steps.

### 1. Define layer constants

Add a file or extend `apps/mobile/src/lib/mapPeopleLayer.ts` with source and layer IDs:

```ts
export const OFFICE_SOURCE_ID = 'doors-offices'
export const OFFICE_LAYER_ID = 'doors-offices-circle'
export const OFFICE_LABEL_ID = 'doors-offices-label'
```

Define paint/layout constants:

```ts
export const officeCirclePaint = {
  'circle-color': '#059669',
  'circle-radius': 8,
  'circle-stroke-width': 2,
  'circle-stroke-color': '#ffffff',
}

export const officeLabelLayout = {
  'text-field': ['get', 'name'],
  'text-size': 12,
  'text-offset': [0, -1.5],
}
```

### 2. Add the source and layers to MapView

**Web** — In `MapView.web.tsx`, add an `ensureOfficeLayer()` function and call it after the basemap loads:

```ts
function ensureOfficeLayer(map: maplibregl.Map, data: GeoJsonFeatureCollection): void {
  const existingSource = map.getSource(OFFICE_SOURCE_ID)

  if (!existingSource) {
    map.addSource(OFFICE_SOURCE_ID, { type: 'geojson', data })
    map.addLayer({ id: OFFICE_LAYER_ID, type: 'circle', source: OFFICE_SOURCE_ID, paint: officeCirclePaint })
    map.addLayer({ id: OFFICE_LABEL_ID, type: 'symbol', source: OFFICE_SOURCE_ID, layout: officeLabelLayout })
    return
  }

  ;(existingSource as maplibregl.GeoJSONSource).setData(data)
}
```

Call it in the `load` handler and the appearance-switch handler. Add a corresponding `removeOfficeLayer()` and wire it to a `officesEnabled` toggle if needed.

**Native** — In `MapView.native.tsx`, add `<GeoJSONSource>` and `<Layer>` children inside `<MaplibreMap>`:

```tsx
<GeoJSONSource id={OFFICE_SOURCE_ID} data={officeData}>
  <Layer id={OFFICE_LAYER_ID} type="circle" paint={officeCirclePaint} />
  <Layer id={OFFICE_LABEL_ID} type="symbol" layout={officeLabelLayout} />
</GeoJSONSource>
```

### 3. Extend the view model

Add the new data source to `useMapViewModel`:

```ts
const {data: officeData} = useMapOffices(viewport, officesEnabled)

return {
  // ...existing properties
  officeData,
  officesEnabled,
}
```

### 4. Create a data hook (if fetching from the API)

Follow the pattern of `useMapPeople`:

```ts
export function useMapOffices(viewport: MapViewport | null, enabled: boolean) {
  // Debounced fetch, stale-response guard, graceful failure
}
```

### 5. Add a server endpoint

Create a route in `apps/server/src/routes/map.ts` or a separate file:

```ts
.get('/offices', async ({workspaceId, query}) => {
  // Return GeoJSON FeatureCollection
})
```

### 6. Wire the toggle (optional)

If the layer should be gated by API health or a user preference, add the toggle logic in `useMapViewModel`:

```ts
const officesEnabled = apiHealth === 'ok' && userPreferences.showOffices
```

---

## 10. App shell integration

`AppShell.tsx` renders the map as a persistent background layer behind navigation and the tab bar.

### Z-index layering

| Layer | Z-index | Pointer events | Description |
|-------|---------|----------------|-------------|
| Map (inactive tabs) | 0 | `'none'` | Non-interactive when another tab is active. |
| Map (Map tab) | 15 | `'box-none'` | Interactive — pointer events pass through the wrapper but reach the map. |
| Navigation | 10 | `'none'` (on Map tab) / `'box-none'` (on other tabs) | Tab scenes sit above the map. |
| Tab bar | 20 | `'box-none'` | Floating nav bar always receives touches. |
| Attribution | 25 | `'none'` | Read-only overlay, never blocks interaction. |

### Interactivity toggle

```tsx
const mapInteractive = activeRoute === 'Map'

<View
  style={[styles.mapLayer, mapInteractive ? styles.mapLayerInteractive : null]}
  pointerEvents={mapInteractive ? 'box-none' : 'none'}>
  <MapView />
</View>
```

When `mapInteractive` is `false`, the map layer has `pointerEvents: 'none'`, so all touches fall through to the navigation layer above it. On the Map tab, the map layer is raised to z-index 15 with `pointerEvents: 'box-none'`, and the navigation layer switches to `pointerEvents: 'none'`.

### Persistent mount

The `<MapView>` component is rendered once inside `AppShellBody` and never unmounts during tab switches. This preserves the map state (pan position, zoom, loaded tiles) across navigation. State changes only when `useMapViewModel` updates — viewport, people data, and appearance.

### Attribution overlay

A small text label using the constant `MAP_ATTRIBUTION` (`'© OpenMapTiles © OpenStreetMap contributors'`) is positioned absolutely at z-index 25:

```tsx
<View style={[styles.attribution, { bottom: attributionBottom }]} pointerEvents="none">
  <Text>{MAP_ATTRIBUTION}</Text>
</View>
```

The `attributionBottom` accounts for the tab bar height on native and the safe-area inset on both platforms.
