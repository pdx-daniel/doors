import maplibregl from 'maplibre-gl'
import {Protocol} from 'pmtiles'

let protocolRegistered = false

/**
 * Registers the PMTiles protocol handler with maplibre-gl so pmtiles:// sources work in the browser.
 * Safe to call multiple times; registration happens only once per page load.
 */
export function registerPmtilesProtocol(): void {
  // Skip when the handler is already installed for this session.
  if (protocolRegistered) {
    return
  }

  // Wire PMTiles range requests into MapLibre's custom protocol API.
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  protocolRegistered = true
}
