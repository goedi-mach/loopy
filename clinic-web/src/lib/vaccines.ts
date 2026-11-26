import { useEffect, useState } from 'react'
import { sbGet } from './api'

// Vaccine types live in the vaccine_types table (one row per vaccine, e.g. DAPP).
// • key: stored on vaccine lots (vaccine_inventory.vaccine_type); never changes
// • label: shown everywhere and saved at the start of each vaccination's name
//   ("DAPP 1 Year"). Pages match a pet's history by this first word, so a label
//   should not be renamed once vaccines have been logged with it.

export interface Duration {
  label: string
  unit: 'years' | 'months' | 'weeks'
  amount: number
  usda?: '1yr' | '3yr'
}

export interface VaccineType {
  key: string
  label: string
  species: string[] // 'dog', 'cat'
  is_rabies: boolean // shows the rabies-certificate fields
  durations: Duration[]
  sort_order: number
  active: boolean
}

const COLUMNS = 'key,label,species,is_rabies,durations,sort_order,active'

// Kept for a minute so every card on a page doesn't ask the database again
let cache: { at: number; list: Promise<VaccineType[]> } | null = null

// All vaccine types (active and inactive), in display order. Pass fresh = true after a change.
export function loadVaccineTypes(fresh = false): Promise<VaccineType[]> {
  if (fresh || !cache || Date.now() - cache.at > 60_000) {
    const list = sbGet<VaccineType[]>(`vaccine_types?select=${COLUMNS}&order=sort_order.asc,label.asc`)
    cache = { at: Date.now(), list }
    list.catch(() => {
      cache = null
    })
  }
  return cache.list
}

// The vaccine types for a page: null while loading, [] if they couldn't be loaded
export function useVaccineTypes(): VaccineType[] | null {
  const [types, setTypes] = useState<VaccineType[] | null>(null)
  useEffect(() => {
    let cancelled = false
    loadVaccineTypes()
      .then((t) => {
        if (!cancelled) setTypes(t)
      })
      .catch(() => {
        if (!cancelled) setTypes([])
      })
    return () => {
      cancelled = true
    }
  }, [])
  return types
}

// Active vaccines given to this species, in display order
export const typesForSpecies = (types: VaccineType[], species: string) =>
  types.filter((t) => t.active && t.species.includes(species))

function iso(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Next due date as YYYY-MM-DD, using plain calendar math (no time zones).
// A month-end date stays inside the target month (e.g. Feb 29 + 1 year = Feb 28).
export function calcNextDue(dateGiven: string, d: Duration): string {
  const [y, m, day] = dateGiven.split('-').map(Number)
  if (d.unit === 'weeks') return iso(new Date(y, m - 1, day + d.amount * 7))
  const months = d.unit === 'years' ? d.amount * 12 : d.amount
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate()
  return iso(new Date(y, m - 1 + months, Math.min(day, lastDay)))
}