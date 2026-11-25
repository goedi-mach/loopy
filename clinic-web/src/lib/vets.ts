import { sbGet } from './api'

// Veterinarians, edited by admins on the Settings page (vets table).
// Active vets are listed under "Administered By"; the primary vet signs rabies certificates.

export interface Vet {
  id: string
  name: string
  license_number: string | null
  signature_path: string | null // file name in the private "signatures" bucket
  is_primary: boolean
  active: boolean
}

const COLUMNS = 'id,name,license_number,signature_path,is_primary,active'

// Kept for a minute, so printing a batch of certificates doesn't ask the database every time
let cache: { at: number; list: Promise<Vet[]> } | null = null

// Primary vet first, then by name. Pass fresh = true right after a change.
export function loadVets(fresh = false): Promise<Vet[]> {
  if (fresh || !cache || Date.now() - cache.at > 60_000) {
    const list = sbGet<Vet[]>(`vets?select=${COLUMNS}&order=is_primary.desc,name.asc`)
    cache = { at: Date.now(), list }
    list.catch(() => {
      cache = null
    })
  }
  return cache.list
}

// Where a vet's signature image is read from (needs a signed-in user's token)
export const signatureUrlPath = (path: string) =>
  `/storage/v1/object/authenticated/signatures/${encodeURIComponent(path)}`
