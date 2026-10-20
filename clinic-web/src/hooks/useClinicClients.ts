import { useEffect, useState } from 'react'
import { request, sbGet } from '../lib/api'
import { todayStr } from '../lib/dates'
import type { Client, EventRow } from '../types'

export type Filter = 'all' | 'registered' | 'discharged'

export function useClinicClients() {
  const [todayEvent, setTodayEvent] = useState<EventRow | null>(null)
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [clients, setClients] = useState<Client[]>([])
  const [listMsg, setListMsg] = useState('Loading…')
  const [query, setQuery] = useState('')
  const [count, setCount] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const clinicType = todayEvent?.clinic_type || null

  // Today's clinic. Booster clinics start on the "registered" filter.
  useEffect(() => {
    async function loadEvent() {
      try {
        const events: EventRow[] = await sbGet(
          `events?event_date=eq.${todayStr()}&order=start_time.asc&limit=1`
        )
        const ev = events[0] || null
        setTodayEvent(ev)
        if (ev?.clinic_type === 'Booster Clinic') setFilter('registered')
      } catch (err) {
        setListMsg(`Error: ${err instanceof Error ? err.message : 'could not load events'}`)
      } finally {
        setEventsLoaded(true)
      }
    }
    loadEvent()
  }, [])

  // Owner count for today
  useEffect(() => {
    async function loadCount() {
      try {
        const res = await request(`/rest/v1/clients?event_date=eq.${todayStr()}`, {
          method: 'HEAD',
          headers: { Prefer: 'count=exact' },
        })
        setCount(res.headers.get('content-range')?.split('/')[1] ?? '0')
      } catch {
        // nice-to-have; ignore failures
      }
    }
    loadCount()
  }, [reloadKey])

  // Client list: reloads when the clinic, filter, or reloadKey changes
  useEffect(() => {
    if (!eventsLoaded) return
    async function loadList() {
      if (!clinicType) {
        setClients([])
        setListMsg('No clinic scheduled today.')
        return
      }
      setListMsg('Loading…')
      try {
        let eventDate = todayStr()
        if (clinicType === 'Booster Clinic') {
          const past: EventRow[] = await sbGet(
            'events?clinic_type=eq.Vaccine Clinic&completed=eq.true&order=event_date.desc&limit=1'
          )
          if (!past.length) {
            setClients([])
            setListMsg('No previous vaccine clinic found.')
            return
          }
          eventDate = past[0].event_date
        }
        let path = `clients?select=id,name,email,phone,address,created_at,status,archived,event_date,street,city,state,zip,notes,snip_interest,preferred_language&archived=eq.false&event_date=eq.${eventDate}&order=created_at.asc&limit=200`
        if (filter !== 'all') path += `&status=eq.${filter}`
        const rows: Client[] = await sbGet(path)
        setClients(rows)
        setListMsg(rows.length ? '' : 'No clients found.')
      } catch (err) {
        setClients([])
        setListMsg(`Error: ${err instanceof Error ? err.message : 'could not load clients'}`)
      }
    }
    loadList()
  }, [eventsLoaded, clinicType, filter, reloadKey])

  async function search() {
    const q = query.trim()
    if (!q) {
      setListMsg('Enter a name, email, or phone.')
      setClients([])
      return
    }
    setListMsg('Searching…')
    try {
      const rows: Client[] = await sbGet(`rpc/search_clients_unaccent?search_term=${encodeURIComponent(q)}`)
      setClients(rows)
      setListMsg(rows.length ? '' : 'No clients found.')
    } catch (err) {
      setClients([])
      setListMsg(`Error: ${err instanceof Error ? err.message : 'search failed'}`)
    }
  }

  // Re-fetch the list and count (after a walk-in, a discharge, etc.)
  function reload() {
    setReloadKey((k) => k + 1)
  }

  // Swap one edited client into the visible list without re-fetching
  function updateClient(updated: Client) {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  return {
    todayEvent, filter, setFilter, clients, listMsg,
    query, setQuery, search, count, reload, updateClient,
  }
}

export type ClinicList = ReturnType<typeof useClinicClients>