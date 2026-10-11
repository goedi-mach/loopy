import type { Pet } from '../types'

export interface PetFormValues {
  name: string
  species: string
  breed: string
  age: string
  age_unit: string
  weight: string
  sex: string
  altered: string
  microchipped: string
  microchip_number: string
  colors_markings: string
}

export const emptyPet: PetFormValues = {
  name: '',
  species: '',
  breed: '',
  age: '',
  age_unit: 'years',
  weight: '',
  sex: 'unknown',
  altered: 'unknown',
  microchipped: 'unknown',
  microchip_number: '',
  colors_markings: '',
}

export function petToForm(p: Pet): PetFormValues {
  return {
    name: p.name || '',
    species: p.species || '',
    breed: p.breed || '',
    age: p.age != null ? String(p.age) : '',
    age_unit: p.age_unit || 'years',
    weight: p.weight != null ? String(p.weight) : '',
    sex: p.sex || 'unknown',
    altered: p.altered || 'unknown',
    microchipped: p.microchipped || 'unknown',
    microchip_number: p.microchip_number || '',
    colors_markings: p.colors_markings || '',
  }
}

export function formToPayload(v: PetFormValues) {
  return {
    name: v.name.trim(),
    species: v.species,
    breed: v.breed.trim() || null,
    age: v.age ? +v.age : null,
    age_unit: v.age_unit || 'years',
    weight: v.weight ? +v.weight : null,
    sex: v.sex || 'unknown',
    altered: v.altered || 'unknown',
    microchipped: v.microchipped || 'unknown',
    microchip_number: v.microchip_number.trim() || null,
    colors_markings: v.colors_markings.trim() || null,
  }
}