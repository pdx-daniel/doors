import {DEV_WORKSPACE_ID} from '@doors/api/constants'
import {uuidv7} from 'uuidv7'

import {closeSql, getSql} from '../src/db/client'
import {createLocation} from '../src/db/repos/locationRepo'
import {createPerson, createPersonAlias} from '../src/db/repos/personRepo'
import {createWorkspace} from '../src/db/repos/workspaceRepo'

/** Fixed UUID for the seeded personal workspace. */
const DEV_PERSONAL_WORKSPACE_ID = '01900000-0000-7000-8000-000000000002'

/** Portland-area venues used as anchors for seeded people. */
const PORTLAND_VENUES = [
  {
    name: 'Pearl District Office',
    address: '1005 NW Lovejoy St',
    type: 'office',
    lng: -122.6819,
    lat: 45.5295,
  },
  {
    name: 'Hawthorne Community Center',
    address: '1234 SE Hawthorne Blvd',
    type: 'community',
    lng: -122.6544,
    lat: 45.5122,
  },
  {
    name: 'Alberta Arts Venue',
    address: '1722 NE Alberta St',
    type: 'venue',
    lng: -122.648,
    lat: 45.559,
  },
  {
    name: 'Mississippi Ave Cafe',
    address: '3928 N Mississippi Ave',
    type: 'venue',
    lng: -122.6759,
    lat: 45.5516,
  },
  {
    name: 'Sellwood Library',
    address: '7860 SE 13th Ave',
    type: 'public',
    lng: -122.6485,
    lat: 45.4634,
  },
  {
    name: 'St Johns Plaza',
    address: '7373 N Ivanhoe St',
    type: 'public',
    lng: -122.753,
    lat: 45.5896,
  },
  {
    name: 'Division Street Market',
    address: '3426 SE Division St',
    type: 'retail',
    lng: -122.6278,
    lat: 45.5051,
  },
  {
    name: 'Nob Hill Apartments',
    address: '2311 NW Thurman St',
    type: 'residence',
    lng: -122.6985,
    lat: 45.5358,
  },
  {
    name: 'Lloyd Center Hub',
    address: '2201 Lloyd Center',
    type: 'retail',
    lng: -122.6538,
    lat: 45.5325,
  },
  {
    name: 'Brooklyn Yard',
    address: '3400 SE Milwaukie Ave',
    type: 'venue',
    lng: -122.635,
    lat: 45.4972,
  },
  {
    name: 'Forest Park Trailhead',
    address: 'NW Germantown Rd',
    type: 'outdoor',
    lng: -122.767,
    lat: 45.542,
  },
  {
    name: 'Central Eastside Workshop',
    address: '901 SE Taylor St',
    type: 'office',
    lng: -122.656,
    lat: 45.5155,
  },
  {
    name: 'Montavilla Neighborhood House',
    address: '7910 SE Stark St',
    type: 'community',
    lng: -122.592,
    lat: 45.519,
  },
  {
    name: 'Cathedral Park Pavilion',
    address: '6637 N Baltimore Ave',
    type: 'outdoor',
    lng: -122.762,
    lat: 45.587,
  },
  {
    name: 'Woodstock Farmers Market',
    address: '4600 SE Woodstock Blvd',
    type: 'retail',
    lng: -122.615,
    lat: 45.479,
  },
  {
    name: 'Kenton Community Hall',
    address: '8105 N Brandon Ave',
    type: 'community',
    lng: -122.685,
    lat: 45.584,
  },
  {
    name: 'Slabtown Studio',
    address: '2030 NW Pettygrove St',
    type: 'office',
    lng: -122.694,
    lat: 45.533,
  },
  {
    name: 'Foster-Powell Center',
    address: '5200 SE Foster Rd',
    type: 'community',
    lng: -122.608,
    lat: 45.497,
  },
  {
    name: 'Rose City Park Clinic',
    address: '1200 NE 47th Ave',
    type: 'public',
    lng: -122.614,
    lat: 45.528,
  },
  {
    name: 'South Waterfront Lab',
    address: '3508 SW Moody Ave',
    type: 'office',
    lng: -122.671,
    lat: 45.499,
  },
] as const

/** Varied headcount per venue so stacks are not uniform. */
const PEOPLE_PER_VENUE = [1, 3, 2, 7, 1, 4, 2, 1, 6, 3, 2, 1, 5, 2, 4, 1, 3, 8, 2, 1] as const

const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Taylor',
  'Morgan',
  'Casey',
  'Riley',
  'Quinn',
  'Avery',
  'Blake',
  'Cameron',
  'Dakota',
  'Emery',
  'Finley',
  'Harper',
  'Indigo',
  'Jules',
  'Kai',
  'Logan',
  'Marlow',
  'Noel',
]

const LAST_NAMES = [
  'Nguyen',
  'Patel',
  'Garcia',
  'Kim',
  'Chen',
  'Johnson',
  'Martinez',
  'Williams',
  'Brown',
  'Lee',
  'Singh',
  'Rivera',
  'Thompson',
  'Clark',
  'Lewis',
  'Walker',
  'Hall',
  'Allen',
  'Young',
  'Wright',
]

const OCCUPATIONS = [
  'engineer',
  'teacher',
  'nurse',
  'designer',
  'chef',
  'driver',
  'analyst',
  'artist',
  'plumber',
  'writer',
]

const GENDERS = ['woman', 'man', 'nonbinary', 'prefer not to say']

type Venue = (typeof PORTLAND_VENUES)[number]

/**
 * Deterministic offset in degrees (~25–90 m) so some people sit near but not on a venue.
 */
function offsetCoordinates(venue: Venue, personIndex: number): {lng: number; lat: number} {
  const angle = ((personIndex * 137.5) % 360) * (Math.PI / 180)
  const distance = 0.00022 + (personIndex % 4) * 0.00006

  return {
    lng: venue.lng + Math.cos(angle) * distance,
    lat: venue.lat + Math.sin(angle) * distance,
  }
}

/**
 * Clears previously seeded dev workspace rows so reseeds stay repeatable.
 */
async function clearDevData(sql: ReturnType<typeof getSql>): Promise<void> {
  await sql`DELETE FROM person_aliases WHERE workspace_id IN (${DEV_WORKSPACE_ID}, ${DEV_PERSONAL_WORKSPACE_ID})`
  await sql`DELETE FROM people WHERE workspace_id IN (${DEV_WORKSPACE_ID}, ${DEV_PERSONAL_WORKSPACE_ID})`
  await sql`DELETE FROM locations WHERE workspace_id = ${DEV_WORKSPACE_ID}`
  await sql`DELETE FROM workspaces WHERE id IN (${DEV_WORKSPACE_ID}, ${DEV_PERSONAL_WORKSPACE_ID})`
}

/**
 * Seeds Portland-area dev data into the database idempotently.
 */
async function seed(): Promise<void> {
  const sql = getSql()

  await clearDevData(sql)

  // Create org and personal workspaces used by local development clients.
  await createWorkspace(sql, {
    id: DEV_WORKSPACE_ID,
    kind: 'org',
    name: 'Doors Dev',
  })
  await createWorkspace(sql, {
    id: DEV_PERSONAL_WORKSPACE_ID,
    kind: 'personal',
    name: 'Dev Personal',
  })

  const venueLocationIds: string[] = []

  // Insert shared venue locations with stable ids for reseeds.
  for (const [index, venue] of PORTLAND_VENUES.entries()) {
    const id = `01900001-0000-7000-8000-${String(index + 1).padStart(12, '0')}`
    const created = await createLocation(sql, {
      id,
      workspaceId: DEV_WORKSPACE_ID,
      name: venue.name,
      address: venue.address,
      locationType: venue.type,
      geometry: {
        type: 'Point',
        coordinates: [venue.lng, venue.lat],
      },
    })
    venueLocationIds.push(created.id)
  }

  let personIndex = 0
  let microLocationIndex = 0

  for (const [venueIndex, venue] of PORTLAND_VENUES.entries()) {
    const peopleCount = PEOPLE_PER_VENUE[venueIndex] ?? 1
    const sharedVenueLocationId = venueLocationIds[venueIndex]

    if (!sharedVenueLocationId) {
      continue
    }

    for (let slot = 0; slot < peopleCount; slot += 1) {
      personIndex += 1
      const firstName = FIRST_NAMES[personIndex % FIRST_NAMES.length] ?? 'Alex'
      const lastName = LAST_NAMES[(personIndex + slot) % LAST_NAMES.length] ?? 'Nguyen'
      const displayName = `${firstName} ${lastName}`
      const personId = `01900002-0000-7000-8000-${String(personIndex).padStart(12, '0')}`

      // Share the venue pin for most people; give every third person their own nearby spot.
      const usesNearbySpot = slot > 0 && personIndex % 3 === 0
      let locationId = sharedVenueLocationId

      if (usesNearbySpot) {
        microLocationIndex += 1
        const offset = offsetCoordinates(venue, personIndex)
        const microLocationId = `01900003-0000-7000-8000-${String(microLocationIndex).padStart(12, '0')}`
        const microLocation = await createLocation(sql, {
          id: microLocationId,
          workspaceId: DEV_WORKSPACE_ID,
          name: `${venue.name} — ${firstName}`,
          address: venue.address,
          locationType: venue.type,
          geometry: {
            type: 'Point',
            coordinates: [offset.lng, offset.lat],
          },
        })
        locationId = microLocation.id
      }

      const person = await createPerson(sql, {
        id: personId,
        workspaceId: DEV_WORKSPACE_ID,
        displayName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${personIndex}@example.com`,
        phone: `503-555-${String(1000 + personIndex).slice(-4)}`,
        locationId,
        metadata: {
          age: 22 + (personIndex % 40),
          gender: GENDERS[personIndex % GENDERS.length],
          occupation: OCCUPATIONS[personIndex % OCCUPATIONS.length],
        },
      })

      // Attach a sample external alias for the first few seeded people.
      if (personIndex <= 5) {
        await createPersonAlias(sql, {
          id: uuidv7(),
          workspaceId: DEV_WORKSPACE_ID,
          personId: person.id,
          source: 'dev-seed',
          externalId: `EXT-${personIndex}`,
        })
      }
    }
  }

  await closeSql()
  console.log(
    `seeded ${PORTLAND_VENUES.length} venues, ${microLocationIndex} nearby spots, and ${personIndex} people`,
  )
}

await seed()
