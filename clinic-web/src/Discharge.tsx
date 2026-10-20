import { useState } from 'react'
import ClientDetail from './ClientDetail'
import ClientListCard from './components/ClientListCard'
import ClinicBanner from './components/ClinicBanner'
import ClinicNav from './components/ClinicNav'
import DischargePanel from './DischargePanel'
import { useClinicClients } from './hooks/useClinicClients'
import { sbPatch } from './lib/api'
import { getRole } from './lib/auth'
import type { Client } from './types'
import './Intake.css'

export default function Discharge() {
  const list = useClinicClients()
  const [selected, setSelected] = useState<Client | null>(null)
  const isAdmin = getRole() === 'admin'
  const [warning, setWarning] = useState('')

  function handleUpdated(updated: Client) {
    setSelected(updated)
    list.updateClient(updated)
  }

  function handleDeleted() {
    setSelected(null)
    list.reload()
  }

  // Logging a vaccine marks the client Discharged
    async function markDischarged() {
    if (!selected || selected.status === 'discharged') return
    try {
      const rows: Client[] = await sbPatch(`clients?id=eq.${selected.id}`, { status: 'discharged' })
      if (!rows.length) throw new Error('not allowed')
      handleUpdated({ ...selected, ...rows[0] })
      list.reload()
      setWarning('')
    } catch (err) {
      console.warn('Could not mark client discharged:', err)
      setWarning('The vaccine was saved, but the client could not be marked Discharged. Please tell an admin.')
    }
  }

  return (
    <div className="intake">
      <ClinicNav active="discharge" />
      <ClinicBanner event={list.todayEvent} />
      {warning && <div className="warning-bar">{warning}</div>}

      <div className="dash-body">
        <ClientListCard list={list} selectedId={selected?.id ?? null} onSelect={setSelected} />

        <div>
          {selected ? (
            <ClientDetail
              key={selected.id}
              client={selected}
              onUpdated={handleUpdated}
              allowDelete={isAdmin}
              showDocuments
              onDeleted={handleDeleted}
              renderPet={(pet, reload) => (
                <DischargePanel key={pet.id} pet={pet} client={selected} onLogged={markDischarged} onPetChanged={reload} />
              )}
            />
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