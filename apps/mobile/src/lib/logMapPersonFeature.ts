import type {MapClusterProperties, MapPersonProperties} from '@doors/api/schemas'

/** Logs person or cluster metadata when a map dot is pressed. */
export function logMapPersonFeature(properties: unknown): void {
  if (!properties || typeof properties !== 'object') {
    return
  }

  const props = properties as MapClusterProperties | MapPersonProperties

  // Log cluster bubbles with aggregate counts.
  if ('cluster' in props && props.cluster === true) {
    console.log('[map] cluster', {
      count: props.count,
      geohash: props.geohash,
    })
    return
  }

  // Log individual person and location fields for debugging.
  console.log('[map] person', {
    personId: props.personId,
    displayName: props.displayName,
    email: props.email,
    phone: props.phone,
    locationId: props.locationId,
    locationName: props.locationName,
    locationType: props.locationType,
    metadata: props.metadata,
  })
}
