import type { ReactNode } from 'react'
import type { ClinicList, Filter } from '../hooks/useClinicClients'
import type { Client } from '../types'

const STATUS_LABEL: Record<string, string> = { registered: 'Registered', discharged: 'Discharged' }
const FILTERS: Filter[] = ['all', 'registered', 'discharged']

interface Props {
  list: ClinicList
  selectedId: string | null
  onSelect: (c: Client) => void
  headerExtra?: ReactNode
}

export default function ClientListCard({ list, selectedId, onSelect, headerExtra }: Props) {
  return (
    <div>
      {list.count !== null && (
        <div className="today-count">
          👥 {list.count} owner{list.count === '1' ? '' : 's'} registered today
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <span>🔍 Search Clients</span>
          {headerExtra}
        </div>
        <div className="card-body">
          <div className="filter-row">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={list.filter === f ? 'filter-btn active' : 'filter-btn'}
                onClick={() => list.setFilter(f)}
              >
                {f === 'all' ? 'All' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>

          <div className="search-wrap">
            <input
              type="text"
              value={list.query}
              placeholder="Name, email, or phone…"
              onChange={(e) => list.setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && list.search()}
            />
            <button type="button" className="btn-search" onClick={list.search}>Search</button>
          </div>

          <ul className="client-list">
            {list.listMsg && <li className="empty-state">{list.listMsg}</li>}
            {list.clients.map((c) => (
              <li
                key={c.id}
                className={c.id === selectedId ? 'client-item selected' : 'client-item'}
                style={c.archived ? { opacity: 0.45 } : undefined}
                onClick={() => onSelect(c)}
              >
                <div className="client-row">
                  <div className="client-name">{c.name}</div>
                  {c.archived ? (
                    <span className="badge badge-archived">Archived</span>
                  ) : (
                    c.status && STATUS_LABEL[c.status] && (
                      <span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                    )
                  )}
                </div>
                <div className="client-meta">
                  {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}