# Navigation and screens

This guide explains the navigation architecture in doors and how to add or modify screens, tabs, stacks, and linking configuration. It assumes you are familiar with the project layout described in the [local setup guide](01-local-setup.md).

---

## 1. Architecture overview

The app uses a **single bottom-tab navigator** (React Navigation 7) with the map rendered persistently underneath all tab scenes. A custom floating pill bar replaces the default tab bar.

### Layer stack

```
NavigationContainer (linking, onStateChange)
  └─ AppShell
       ├─ MapView (z-index 0)  ← always mounted, never unmounts
       ├─ RootNavigator (z-index 10)
       │    ├─ MapScreen (transparent pass-through)
       │    ├─ Dummy1 (FloatingPanelOverlay)
       │    └─ SettingsScreen (opaque full page)
       ├─ FloatingNavBar (z-index 20)  ← floating pill, positioned by TabBarBridge
       └─ Attribution (z-index 25)
```

Key design decisions:

- **The map never unmounts.** Tab screens are shown/hidden on top of it. Switching tabs does not tear down MapLibre.
- **Map interactivity is toggled** via `pointerEvents`. When the Map tab is active, the map layer is interactive (`z-index: 15`, `pointerEvents: 'box-none'`) and the navigation layer above it is transparent (`pointerEvents: 'none'`). When any other tab is active, the map is non-interactive and the navigation layer receives touches.
- **Tab screens that are blurred remain mounted** but render a hidden placeholder with `pointerEvents: "none"`. This avoids unmount/remount cycles when the user taps back to a tab.
- **The floating nav bar is not rendered by the navigator.** `TabBarBridge` publishes the navigator's `BottomTabBarProps` to `AppShell`, which renders `FloatingNavBar` as a sibling above the navigation layer. This keeps the nav bar visually independent from scene transitions.

### Platform differences

| Aspect | Web | Native (iOS / Android) |
|--------|-----|------------------------|
| Nav bar position | Top-aligned, below safe area | Bottom-aligned, above safe area |
| "Doors" brand button | Visible on the left in the pill | Hidden (no brand tap-target) |
| Tab layout | Right-aligned inside the pill | `justify-around` across the pill |
| Deep linking | URL path segments (`/settings`) | Not active in development |

---

## 2. Key files

| File | Purpose |
|------|---------|
| `apps/mobile/src/navigation/routes.ts` | Route name type, tab definitions, home route constant |
| `apps/mobile/src/navigation/linking.ts` | React Navigation `LinkingOptions`, param list type |
| `apps/mobile/src/navigation/RootNavigator.tsx` | Bottom-tab navigator with screen registrations |
| `apps/mobile/src/navigation/layout.ts` | Floating nav height, margins, content inset helpers |
| `apps/mobile/src/components/AppShell.tsx` | Navigation container, map layer, floating nav bar |
| `apps/mobile/src/components/TabBarBridge.tsx` | Publishes tab props to AppShell without rendering a bar |
| `apps/mobile/src/components/FloatingNavBar.tsx` | Custom floating pill tab bar |
| `apps/mobile/src/components/FloatingPanelOverlay.tsx` | Reusable floating card panel for overlay tabs |
| `apps/mobile/src/screens/MapScreen.tsx` | Transparent pass-through route |
| `apps/mobile/src/screens/SettingsScreen.tsx` | Full-page settings with opaque background |

---

## 3. Adding a new tab

Adding a tab requires touching four files and optionally creating a screen component. The example below adds a "List" tab.

### 3a. Define the route name

In `routes.ts`, add the new name to the `RootTabRouteName` union type:

```ts
export type RootTabRouteName = 'Map' | 'Dummy1' | 'Settings' | 'List'
```

### 3b. Add tab metadata

In the same file, add an entry to `ROOT_TABS`:

```ts
export const ROOT_TABS: RootTabDefinition[] = [
  {name: 'Map', label: 'Map', path: ''},
  {name: 'Dummy1', label: 'Dummy 1', path: 'dummy-1'},
  {name: 'List', label: 'List', path: 'list'},
  {name: 'Settings', label: 'Settings', path: 'settings'},
]
```

The `path` field is the URL segment used by the web linking config. An empty string means the home route.

### 3c. (Optional) Create a screen component

If the tab needs a custom screen, create a file at `apps/mobile/src/screens/ListScreen.tsx`:

```tsx
import type {ReactElement} from 'react'
import {Platform, ScrollView, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {Box} from '@/components/ui/box'
import {Text} from '@/components/ui/text'
import {getFloatingNavContentInsets} from '@/navigation/layout'

export function ListScreen(): ReactElement {
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'
  const contentInsets = getFloatingNavContentInsets(insets, isWeb)

  return (
    <Box className="flex-1 bg-gray-950" style={contentInsets}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text className="text-xl font-bold text-gray-50">List</Text>
      </ScrollView>
    </Box>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
})
```

Follow the same pattern as `SettingsScreen`:

- Use `getFloatingNavContentInsets` to keep content clear of the floating nav bar.
- Apply `bg-gray-950` (or any opaque background) if the screen should cover the map.
- For transparent overlay tabs you can use `FloatingPanelOverlay` instead (see Dummy1).

### 3d. Register the screen in RootNavigator

In `RootNavigator.tsx`, import and add a `<Tab.Screen>`:

```tsx
import {ListScreen} from '@/screens/ListScreen'

// Inside <Tab.Navigator>
<Tab.Screen name="List" component={ListScreen} />
```

If the tab should render a `FloatingPanelOverlay` (a floating card above the map), use the render-prop pattern instead:

```tsx
<Tab.Screen name="List">
  {(): ReactElement => (
    <FloatingPanelOverlay title="List" description="Items go here." />
  )}
</Tab.Screen>
```

### 3e. Verify

1. The tab label appears in the floating nav bar (the bar reads from `ROOT_TABS`).
2. Tapping the tab navigates to the new screen.
3. On web, navigating to `/list` loads the List tab.
4. TypeScript and Biome pass (`bun run typecheck && bun run ci`).

---

## 4. Adding a stack navigator inside a tab

Some tabs need a nested stack (e.g., Settings with a sub-page for an individual setting). React Navigation supports nesting a stack inside a tab screen.

### 4a. Create the stack navigator

Add a file at `apps/mobile/src/navigation/SettingsStack.tsx`:

```tsx
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import type {ReactElement} from 'react'

import {SettingsDetailScreen} from '@/screens/SettingsDetailScreen'
import {SettingsScreen} from '@/screens/SettingsScreen'

export type SettingsStackParamList = {
  SettingsMain: undefined
  SettingsDetail: {itemId: string}
}

const Stack = createNativeStackNavigator<SettingsStackParamList>()

export function SettingsStack(): ReactElement {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="SettingsDetail" component={SettingsDetailScreen} />
    </Stack.Navigator>
  )
}
```

> If you are using `@react-navigation/native-stack`, add it to `apps/mobile/package.json` first: `bun add @react-navigation/native-stack`.

### 4b. Register the stack in RootNavigator

Replace the direct `SettingsScreen` import with the stack:

```tsx
import {SettingsStack} from '@/navigation/SettingsStack'

// Inside <Tab.Navigator>
<Tab.Screen name="Settings" component={SettingsStack} />
```

### 4c. Navigate within the stack

From anywhere inside the Settings tab tree, use the stack navigator to push a detail screen:

```tsx
import {useNavigation} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {SettingsStackParamList} from '@/navigation/SettingsStack'

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'>

function MyComponent(): ReactElement {
  const navigation = useNavigation<Nav>()

  return (
    <Button title="Open detail" onPress={() => navigation.navigate('SettingsDetail', {itemId: 'abc'})} />
  )
}
```

### 4d. Update the linking config

If the detail screen needs a direct URL, add it to the nested screens config in `linking.ts`:

```ts
const rootTabScreens = {
  Map: '',
  Dummy1: 'dummy-1',
  Settings: {
    path: 'settings',
    screens: {
      SettingsMain: '',
      SettingsDetail: 'detail/:itemId',
    },
  },
  List: 'list',
}
```

The type for `rootTabScreens` is currently derived from `ROOT_TABS` using a complex conditional type. When adding nested screens you may need to replace the computed object with an explicit literal. Update the `linking` export to use the explicit structure:

```ts
export const linking: LinkingOptions<RootTabParamList> = {
  prefixes: [getWebPrefix()],
  config: {
    screens: {
      Map: '',
      Dummy1: 'dummy-1',
      Settings: {
        path: 'settings',
        screens: {
          SettingsMain: '',
          SettingsDetail: 'detail/:itemId',
        },
      },
      List: 'list',
    } as LinkingOptions<RootTabParamList>['config'] extends {screens: infer S} ? S : never,
  },
}
```

---

## 5. Web linking

### 5a. How paths map to routes

The `linking` config in `linking.ts` maps URL path segments to route names. When the web app loads at a given URL, React Navigation parses the path and navigates to the matching tab.

| URL path | Tab | Notes |
|----------|-----|-------|
| `/` | Map | Home route, empty string in config |
| `/dummy-1` | Dummy1 | Dashed segment matches the `path` field |
| `/settings` | Settings | Direct tab match |
| `/settings/detail/abc` | Settings > SettingsDetail | Nested stack screen (if configured) |
| `/list` | List | New tab example from section 3 |

The web prefix is resolved dynamically:

- In the browser: `window.location.origin`
- During SSR / Node: `WEB_DEV_SERVER_ORIGIN` from `@/constants/map`

### 5b. Tab bar navigation from the browser

The `FloatingNavBar` already handles navigation through React Navigation's `navigation.navigate()`. On web, the URL updates automatically because the `NavigationContainer` has the `linking` prop set.

No extra work is needed to sync the URL — React Navigation handles it.

---

## 6. Layout patterns

### 6a. Floating nav insets

Content screens must leave room for the floating nav bar. Use `getFloatingNavContentInsets` to compute the required padding:

```ts
import {getFloatingNavContentInsets} from '@/navigation/layout'

function MyScreen(): ReactElement {
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'
  const contentInsets = getFloatingNavContentInsets(insets, isWeb)
  // → {paddingTop, paddingBottom}

  return <View style={contentInsets}>{/* content */}</View>
}
```

The function returns different padding depending on the platform:

- **Web:** Adds extra `paddingTop` for the top-aligned nav bar.
- **Native:** Adds extra `paddingBottom` for the bottom-aligned nav bar.

The three constants used internally are:

| Constant | Value | Purpose |
|----------|-------|---------|
| `FLOATING_NAV_HEIGHT` | `56` | Height of the pill bar |
| `FLOATING_NAV_MARGIN` | `12` | Gap between pill and screen edge |
| `FLOATING_NAV_CONTENT_GAP` | `16` | Extra inset between pill and scrollable content |

### 6b. Floating panel insets

For overlay panels that are absolutely positioned (like `FloatingPanelOverlay`), use `getFloatingPanelInsets` instead:

```ts
const panelInsets = getFloatingPanelInsets(insets, isWeb)
// → {top, bottom}
```

This calls `getFloatingNavContentInsets` and maps `paddingTop` → `top` and `paddingBottom` → `bottom`.

### 6c. Web vs native differences

| Concern | Web | Native |
|---------|-----|--------|
| Nav bar position | `top: insets.top + 12` | `bottom: insets.bottom + 12` |
| Safe area | `insets.top` accounts for browser chrome | Safe area insets from `react-native-safe-area-context` |
| Attribution bottom | `8 + insets.bottom` (near bottom-left) | `FLOATING_NAV_HEIGHT + FLOATING_NAV_MARGIN + insets.bottom` (above nav) |
| Map interactivity | `pointerEvents: 'none'` on the transparent `MapScreen` scene for web specifically | Same logic via `mapInteractive` state |

---

## 7. Map integration

### 7a. Persistent map

The map (`MapView`) is rendered in `AppShell` outside the navigation tree. It never unmounts when the user switches tabs. This avoids costly map re-initialization and preserves the camera position.

```tsx
{/* AppShell layout */}
<View style={styles.mapLayer} pointerEvents={mapInteractive ? 'box-none' : 'none'}>
  <MapView />
</View>
<View style={styles.navigationLayer} pointerEvents={mapInteractive ? 'none' : 'box-none'}>
  <RootNavigator onTabBarChange={handleTabBarChange} />
</View>
```

### 7b. Map interactivity toggling

The `activeRoute` state tracks the current tab. When `activeRoute === 'Map'`:

- The map layer gets `z-index: 15` and `pointerEvents: 'box-none'`.
- The navigation layer gets `pointerEvents: 'none'`.
- Map gestures (pan, zoom, click) reach MapLibre.

When any other tab is active:

- The map layer gets `z-index: 0` and `pointerEvents: 'none'`.
- The navigation layer gets `pointerEvents: 'box-none'`.
- Touch events reach the tab screen above.

### 7c. Scene transparency

The navigator sets `sceneStyle: {backgroundColor: 'transparent'}` globally. Individual screens can override this:

- `MapScreen` uses `pointerEvents: "none"` on web so clicks pass through to the map.
- `SettingsScreen` uses an opaque background (`bg-gray-950`) to cover the map completely.
- `FloatingPanelOverlay` keeps the map partially visible behind a floating card.

---

## 8. Shared navigation patterns

### 8a. TabBarBridge

`TabBarBridge` is a renderless component that extracts `BottomTabBarProps` from React Navigation and publishes them up to `AppShell` via the `onChange` callback. This decouples the navigator tree from the custom floating bar.

It avoids infinite render loops by tracking a `tabStateKey` (composed of `state.key` and `state.index`) and only calling `onChange` when the key changes.

### 8b. FloatingNavBar

`FloatingNavBar` receives the tab `state` and `navigation` props and renders a pill-shaped bar. It reads `ROOT_TABS` to resolve display labels. The bar is positioned absolutely:

- **Web:** `top: insets.top + FLOATING_NAV_MARGIN`
- **Native:** `bottom: insets.bottom + FLOATING_NAV_MARGIN`

The bar is rendered in its own layer (`z-index: 20`) above both the map and navigation scenes.

### 8c. FloatingPanelOverlay

`FloatingPanelOverlay` is a reusable component for tabs that show a floating card above the map (e.g., Dummy1). It:

- Uses `getFloatingPanelInsets` for absolute positioning.
- Renders a transparent full-screen wrapper so map gestures pass through outside the card.
- Returns a hidden placeholder when the tab is blurred (checked via `useIsFocused`).
- Provides a dismiss button that navigates back to the home route.

---

## 9. Best practices

### Keep screens lean

A screen component should do two things:
1. Compute its layout insets from `getFloatingNavContentInsets` (or `getFloatingPanelInsets`).
2. Render its content or return a hidden placeholder when blurred.

Push business logic into hooks and child components. Do not fetch data directly inside the screen component — use a dedicated hook or a data-loading component.

### Use layout constants over magic numbers

Always use the exported constants (`FLOATING_NAV_HEIGHT`, `FLOATING_NAV_MARGIN`, `FLOATING_NAV_CONTENT_GAP`) and the helper functions (`getFloatingNavContentInsets`, `getFloatingPanelInsets`) rather than hard-coding pixel values. This keeps the layout consistent when these values change.

### Web URL parity

Every tab with a meaningful route should have a unique `path` in `ROOT_TABS`. The path should use kebab-case for multi-word names (e.g., `'dummy-1'`, `'user-profile'`). Verify that the URL updates correctly when navigating between tabs on web.

### Handle blurred tabs

Tab screens remain mounted when inactive. Always check `useIsFocused()` and return a hidden placeholder when the screen is not focused:

```tsx
const isFocused = useIsFocused()

if (!isFocused) {
  return <View style={styles.hidden} pointerEvents="none" />
}
```

This avoids running effects, timers, or data fetching on invisible screens.

### Use sceneStyle for per-screen overrides

Set `sceneStyle` on individual `<Tab.Screen>` options when a tab needs different background behavior:

```tsx
<Tab.Screen
  name="Map"
  component={MapScreen}
  options={{
    sceneStyle: Platform.select({
      web: {backgroundColor: 'transparent', pointerEvents: 'none'},
      default: {backgroundColor: 'transparent'},
    }),
  }}
/>
```

### Test both platforms

Always verify new or modified navigation behavior on both web and native:

- **Web:** Open the browser, navigate between tabs, check that the URL updates and that the back/forward buttons work.
- **Native:** Run the iOS simulator, tap through tabs, verify that the map preserves its position when returning to the Map tab.

Run `bun run typecheck` and `bun run ci` after any navigation changes to catch type and lint issues.
