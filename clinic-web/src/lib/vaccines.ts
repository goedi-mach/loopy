export interface VaccineOption {
  label: string
  inventoryKey: string
  isRabies: boolean
}

export interface Duration {
  label: string
  unit: 'years' | 'months' | 'weeks'
  amount: number
  usda?: '1yr' | '3yr'
}

export const VACCINE_OPTIONS: Record<string, VaccineOption[]> = {
  dog: [
    { label: 'DAPP', inventoryKey: 'dapp', isRabies: false },
    { label: 'Lepto', inventoryKey: 'dapp_lepto', isRabies: false },
    { label: 'Rabies', inventoryKey: 'rabies', isRabies: true },
  ],
  cat: [
    { label: 'FVRCP', inventoryKey: 'fvrcp', isRabies: false },
    { label: 'Rabies', inventoryKey: 'rabies', isRabies: true },
  ],
}

export const DURATIONS: Record<string, Duration[]> = {
  rabies: [
    { label: '1 Year', unit: 'years', amount: 1, usda: '1yr' },
    { label: '3 Year', unit: 'years', amount: 3, usda: '3yr' },
  ],
  dapp: [
    { label: '4 Weeks', unit: 'weeks', amount: 4 },
    { label: '1 Year', unit: 'months', amount: 12 },
    { label: '3 Year', unit: 'months', amount: 36 },
  ],
  dapp_lepto: [
    { label: '4 Weeks', unit: 'weeks', amount: 4 },
    { label: '1 Year', unit: 'months', amount: 12 },
  ],
  fvrcp: [
    { label: '4 Weeks', unit: 'weeks', amount: 4 },
    { label: '1 Year', unit: 'months', amount: 12 },
    { label: '3 Year', unit: 'months', amount: 36 },
  ],
}

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