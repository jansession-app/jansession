import type { Jam } from './types'

export type JamMapLinks = {
  appleMaps: string
  googleMaps: string
}

export function buildJamMapLinks(locationAddress?: string): JamMapLinks | null {
  if (!locationAddress?.trim()) return null
  const encodedAddress = encodeURIComponent(locationAddress)
  return {
    appleMaps: `https://maps.apple.com/?q=${encodedAddress}`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
  }
}

export function jamLocationDetails(jam: Pick<Jam, 'location' | 'locationAddress'>) {
  return {
    name: jam.location,
    address: jam.locationAddress,
    mapLinks: buildJamMapLinks(jam.locationAddress),
  }
}
