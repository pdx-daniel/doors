import type {MapClusterProperties, MapPersonProperties} from '@doors/api/schemas'

/** Logs person, stack, or cluster metadata when a map dot is pressed. */
export function logMapPersonFeature(properties: unknown): void {
  if (!properties || typeof properties !== 'object') {
    return
  }

  const props = properties as MapClusterProperties | MapPersonProperties

  // Log geohash clusters with aggregate counts.
  if ('cluster' in props && props.cluster === true) {
    console.log('[map] cluster', {
      count: props.count,
      geohash: props.geohash,
    })
    return
  }

  const personProps = props as MapPersonProperties

  // Log co-located stacks that share a map dot.
  if (personProps.stacked && personProps.count > 1) {
    console.log('[map] stack', {
      count: personProps.count,
      locationId: personProps.locationId,
      locationName: personProps.locationName,
      locationType: personProps.locationType,
      representative: personProps.displayName,
    })
    return
  }

  // Log individual person and location fields for debugging.
  console.log('[map] person', {
    personId: personProps.personId,
    displayName: personProps.displayName,
    email: personProps.email,
    phone: personProps.phone,
    locationId: personProps.locationId,
    locationName: personProps.locationName,
    locationType: personProps.locationType,
    metadata: personProps.metadata,
  })
}
