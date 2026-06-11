/** Primary tab route names used by the root navigator. */
export type RootTabRouteName = 'Map' | 'Dummy1' | 'Dummy2'

/** Metadata for a single root tab (label and web path segment). */
export type RootTabDefinition = {
  name: RootTabRouteName
  label: string
  path: string
}

/** Ordered list of root tabs shown in the floating nav bar. */
export const ROOT_TABS: RootTabDefinition[] = [
  {name: 'Map', label: 'Map', path: ''},
  {name: 'Dummy1', label: 'Dummy 1', path: 'dummy-1'},
  {name: 'Dummy2', label: 'Dummy 2', path: 'dummy-2'},
]
