import { fmtTime } from '../lib/dates'
import type { EventRow } from '../types'

export default function ClinicBanner({ event }: { event: EventRow | null }) {
  if (!event) return null
  return (
    <div className="clinic-banner">
      <span>📅</span>
      <span>
        Today's Clinic: {event.location} · {fmtTime(event.start_time)}
        {event.end_time ? ` – ${fmtTime(event.end_time)}` : ''}
      </span>
    </div>
  )
}