import {uuidv7} from 'uuidv7'

/** Generates a time-sortable UUID v7 string. */
export function newId(): string {
  return uuidv7()
}
