export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  status: string | null
  archived: boolean
  event_date: string | null
  created_at: string
  notes: string | null
  snip_interest: boolean | null
  preferred_language: string | null
}

export interface Pet {
  id: string
  client_id: string
  name: string
  species: string | null
  breed: string | null
  age: number | null
  age_unit: string | null
  weight: number | null
  sex: string | null
  altered: string | null
  microchipped: string | null
  microchip_number: string | null
  colors_markings: string | null
  archived: boolean
  photo_updated_at: string | null
}

export interface Vaccination {
  id: string
  pet_id: string
  vaccine_name: string
  lot_number: string | null
  date_given: string | null
  next_due: string | null
  administered_by: string | null
}

export interface EventRow {
  id: string
  event_date: string
  start_time: string
  end_time: string | null
  location: string
  clinic_type: string | null
  completed: boolean
}