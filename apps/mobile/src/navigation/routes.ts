/** Primary tab route names used by the root navigator. */
export type RootTabRouteName = 'Map' | 'Turf' | 'Dummy1' | 'Settings'

/** Metadata for a single root tab (label and web path segment). */
export type RootTabDefinition = {
  name: RootTabRouteName
  label: string
  path: string
}

/** Ordered list of root tabs shown in the floating nav bar. */
export const ROOT_TABS: RootTabDefinition[] = [
  {name: 'Map', label: 'Map', path: ''},
  {name: 'Turf', label: 'Turf', path: 'turf'},
  {name: 'Dummy1', label: 'Dummy 1', path: 'dummy-1'},
  {name: 'Settings', label: 'Settings', path: 'settings'},
]

/** Routes where the map layer accepts pan/zoom and feature interaction. */
export const MAP_INTERACTIVE_ROUTES: RootTabRouteName[] = ['Map', 'Turf']

/** Default home route for brand / dismiss actions. */
export const ROOT_HOME_ROUTE: RootTabRouteName = 'Map'
