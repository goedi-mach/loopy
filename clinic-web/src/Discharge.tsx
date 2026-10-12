import { useState } from 'react'
import ClientDetail from './ClientDetail'
import ClientListCard from './components/ClientListCard'
import ClinicBanner from './components/ClinicBanner'
import ClinicNav from './components/ClinicNav'
import { useClinicClients } from './hooks/useClinicClients'
import type { Client } from './types'
import './Intake.css'

// Discharge shares Intake's styles (they use the same ".intake" wrapper for now)
export default function Discharge() {
  const list = useClinicClients()
  const [selected, setSelected] = useState<Client | null>(null)

  function handleUpdated(updated: Client) {
    setSelected(updated)
    list.updateClient(updated)
  }

  return (
    <div className="intake">
      <ClinicNav active="discharge" />
      <ClinicBanner event={list.todayEvent} />

      <div className="dash-body">
        <ClientListCard list={list} selectedId={selected?.id ?? null} onSelect={setSelected} />

        <div>
          {selected ? (
            <ClientDetail key={selected.id} client={selected} onUpdated={handleUpdated} />
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="quick-ref">
                  <div className="quick-ref-title">👋 Quick Reference</div>
                  <div className="quick-ref-item"><span>🔍</span><div><strong>Find a client</strong> using the search bar to pull up their record.</div></div>
                  <div className="quick-ref-item"><span>🐾</span><div><strong>Select a pet</strong> from their record to log vaccines or a microchip.</div></div>
                  <div className="quick-ref-item"><span>💉</span><div><strong>Log each vaccine</strong> with the lot number. A rabies cert will be generated.</div></div>
                  <div className="quick-ref-item"><span>✅</span><div><strong>Status updates automatically</strong> to Discharged when a vaccine is logged.</div></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}