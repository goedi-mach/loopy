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