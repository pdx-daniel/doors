import {DEV_WORKSPACE_ID} from '@doors/api/constants'
import {uuidv7} from 'uuidv7'

import {closeSql, getSql} from '../src/db/client'
import {createLocation} from '../src/db/repos/locationRepo'
import {createPerson, createPersonAlias} from '../src/db/repos/personRepo'
import {createWorkspace} from '../src/db/repos/workspaceRepo'

/** Fixed UUID for the seeded personal workspace. */
const DEV_PERSONAL_WORKSPACE_ID = '01900000-0000-7000-8000-000000000002'

/** Portland-area locations used by the dev seed dataset. */
const PORTLAND_LOCATIONS = [
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

/**
 * Seeds Portland-area dev data into the database idempotently.
 */
async function seed(): Promise<void> {
  const sql = getSql()

  // Reset dev workspace rows so seed runs are repeatable locally.
  await sql`DELETE FROM workspaces WHERE id IN (${DEV_WORKSPACE_ID}, ${DEV_PERSONAL_WORKSPACE_ID})`

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

  const locationIds: string[] = []

  // Insert Portland locations with fixed ids derived from index for stable reseeds.
  for (const [index, location] of PORTLAND_LOCATIONS.entries()) {
    const id = `01900001-0000-7000-8000-${String(index + 1).padStart(12, '0')}`
    const created = await createLocation(sql, {
      id,
      workspaceId: DEV_WORKSPACE_ID,
      name: location.name,
      address: location.address,
      locationType: location.type,
      geometry: {
        type: 'Point',
        coordinates: [location.lng, location.lat],
      },
    })
    locationIds.push(created.id)
  }

  // Create roughly five people per location with varied demographics metadata.
  let personIndex = 0
  for (const locationId of locationIds) {
    for (let slot = 0; slot < 5; slot += 1) {
      personIndex += 1
      const firstName = FIRST_NAMES[personIndex % FIRST_NAMES.length] ?? 'Alex'
      const lastName = LAST_NAMES[(personIndex + slot) % LAST_NAMES.length] ?? 'Nguyen'
      const displayName = `${firstName} ${lastName}`
      const personId = `01900002-0000-7000-8000-${String(personIndex).padStart(12, '0')}`

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
  console.log(`seeded ${locationIds.length} locations and ${personIndex} people`)
}

await seed()
