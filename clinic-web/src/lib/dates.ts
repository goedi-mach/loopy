// Local date as YYYY-MM-DD (UTC flips to "tomorrow" in the evening)
export function todayStr() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function fmtTime(t: string) {
  const [h, m] = t.split(':')
  const hour = +h
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function dayNumber(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

export function todayNumber() {
  const t = new Date()
  return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 86400000)
}

export function fmtShort(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtNumeric(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}