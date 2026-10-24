import { useState } from 'react'
import ClientDetail from './ClientDetail'
import ClientListCard from './components/ClientListCard'
import ClinicBanner from './components/ClinicBanner'
import ClinicNav from './components/ClinicNav'
import { useClinicClients } from './hooks/useClinicClients'
import type { Client } from './types'
import WalkIn from './WalkIn'
import './Intake.css'

export default function Intake() {
  const list = useClinicClients()
  const [selected, setSelected] = useState<Client | null>(null)
  const [showWalkin, setShowWalkin] = useState(false)

  function handleUpdated(updated: Client) {
    setSelected(updated)
    list.updateClient(updated)
  }

  function handleWalkinSaved(client: Client) {
    setShowWalkin(false)
    setSelected(client)
    list.reload()
  }

  function handleUseExisting(client: Client) {
    setShowWalkin(false)
    setSelected(client)
  }

  return (
    <div className="intake">
      <ClinicNav active="intake" />
      <ClinicBanner event={list.todayEvent} />

      <div className="dash-body">
        <ClientListCard
          list={list}
          selectedId={selected?.id ?? null}
          onSelect={(c) => { setShowWalkin(false); setSelected(c) }}
          headerExtra={
            <button type="button" className="btn-primary btn-small" onClick={() => setShowWalkin(true)}>
              + Walk-in
            </button>
          }
        />

        <div>
          {showWalkin ? (
            <WalkIn
              onSaved={handleWalkinSaved}
              onUseExisting={handleUseExisting}
              onClose={() => setShowWalkin(false)}
            />
          ) : selected ? (
            <ClientDetail key={selected.id} client={selected} onUpdated={handleUpdated} />
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">Select a client to see their details.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}