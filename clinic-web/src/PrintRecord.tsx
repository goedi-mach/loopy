import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { sbGet } from './lib/api'
import type { Client, Pet, Vaccination } from './types'
import './PrintRecord.css'

const COLUMNS = 'id,name,email,phone,address,street,city,state,zip'

const TEXT = {
  en: {
    title: 'Vaccination History', owner: 'Owner', petInfo: 'Pet Information', species: 'Species', breed: 'Breed',
    color: 'Color', sex: 'Sex', age: 'Age', altered: 'Spayed/Neutered', microchip: 'Microchip #',
    nextDue: 'Vaccinations Next Due', history: 'Vaccination History', lotNum: 'Lot #', dateGiven: 'Date Given',
    nextDueCol: 'Next Due', adminBy: 'Administered By', completed: 'Completed', rabiesTag: 'Rabies Tag #',
    noHistory: 'No vaccinations on record.', noNextDue: 'No upcoming vaccinations.', yes: 'Yes', no: 'No',
    yrs: 'yrs', mos: 'months', printed: 'Printed', locale: 'en-US',
    footer: 'Thank you for keeping your pet healthy! Questions? Contact us at peoplehelpingpets.org',
    print: 'Print', loading: 'Loading…',
  },
  es: {
    title: 'Historial de Vacunación', owner: 'Dueño/a', petInfo: 'Información de la Mascota', species: 'Especie', breed: 'Raza',
    color: 'Color', sex: 'Sexo', age: 'Edad', altered: 'Esterilizado/a', microchip: '# de Microchip',
    nextDue: 'Próximas Vacunas', history: 'Historial de Vacunas', lotNum: '# de Lote', dateGiven: 'Fecha de Aplicación',
    nextDueCol: 'Próxima Dosis', adminBy: 'Administrado Por', completed: 'Completado', rabiesTag: '# de Placa Antirrábica',
    noHistory: 'Sin vacunas registradas.', noNextDue: 'Sin próximas vacunas.', yes: 'Sí', no: 'No',
    yrs: 'años', mos: 'meses', printed: 'Impreso', locale: 'es-MX',
    footer: '¡Gracias por cuidar la salud de tu mascota! ¿Preguntas? Contáctanos en peoplehelpingpets.org',
    print: 'Imprimir', loading: 'Cargando…',
  },
}

// The first word of the vaccine name identifies the vaccine (Rabies, DAPP, ...)
const base = (name: string) => name.split(' ')[0]

export default function PrintRecord() {
  const { id, petId } = useParams()
  const [params] = useSearchParams()
  const lang = params.get('lang') === 'es' ? 'es' : 'en'
  const t = TEXT[lang]

  const [client, setClient] = useState<Client | null>(null)
  const [pet, setPet] = useState<Pet | null>(null)
  const [vax, setVax] = useState<Vaccination[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      sbGet<Client[]>(`clients?id=eq.${id}&select=${COLUMNS}`),
      sbGet<Pet[]>(`pets?id=eq.${petId}&client_id=eq.${id}`),
      sbGet<Vaccination[]>(`vaccinations?pet_id=eq.${petId}&order=date_given.desc`),
    ])
      .then(([c, p, v]) => {
        if (!c.length || !p.length) throw new Error('Record not found')
        setClient(c[0])
        setPet(p[0])
        setVax(v)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the record'))
  }, [id, petId])

  // Open the print dialog once everything has loaded
  useEffect(() => {
    if (client && pet && vax) {
      const timer = setTimeout(() => window.print(), 400)
      return () => clearTimeout(timer)
    }
  }, [client, pet, vax])

  if (error) return <div className="print-page"><p>{error}</p></div>
  if (!client || !pet || !vax) return <div className="print-page"><p>{t.loading}</p></div>

  const fmt = (iso: string | null) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(t.locale, { month: 'long', day: 'numeric', year: 'numeric' })
  }
  const today = new Date().toLocaleDateString(t.locale, { month: 'long', day: 'numeric', year: 'numeric' })

  const isSuperseded = (v: Vaccination) =>
    vax.some((o) => o.id !== v.id && base(o.vaccine_name) === base(v.vaccine_name) && (o.date_given || '') > (v.date_given || ''))

  // Most recent record per vaccine that has a next-due date
  const seen = new Set<string>()
  const nextDue: Vaccination[] = []
  for (const v of vax) {
    if (!v.next_due) continue
    const b = base(v.vaccine_name)
    if (!seen.has(b)) {
      seen.add(b)
      nextDue.push(v)
    }
  }

  const colors = pet.colors_markings || vax.find((v) => v.colors_markings)?.colors_markings || ''
  const address = [client.street || client.address, client.city, client.state, client.zip].filter(Boolean).join(', ')
  const ageText = pet.age != null ? `${pet.age} ${pet.age_unit === 'months' ? t.mos : t.yrs}` : '—'

  return (
    <div className="print-page">
      <div className="no-print print-bar">
        <button type="button" onClick={() => window.print()}>🖨 {t.print}</button>
      </div>

      <div className="print-top">
        <div className="print-org">🐾 People Helping Pets</div>
        <div className="print-owner">
          <strong>{client.name}</strong>
          {address && <div>{address}</div>}
          {client.phone && <div>{client.phone}</div>}
          {client.email && <div>{client.email}</div>}
        </div>
      </div>

      <h1>📋 {t.title}</h1>
      <div className="print-muted">{t.printed}: {today}</div>
      <div className="print-pet">{pet.name}</div>

      <div className="print-section">{t.petInfo}</div>
      <div className="print-grid">
        <div><label>{t.species}</label><span>{pet.species || '—'}</span></div>
        <div><label>{t.breed}</label><span>{pet.breed || '—'}</span></div>
        <div><label>{t.color}</label><span>{colors || '—'}</span></div>
        <div><label>{t.sex}</label><span>{pet.sex || '—'}</span></div>
        <div><label>{t.age}</label><span>{ageText}</span></div>
        <div><label>{t.altered}</label><span>{pet.altered === 'yes' ? t.yes : pet.altered === 'no' ? t.no : '—'}</span></div>
        <div><label>{t.microchip}</label><span>{pet.microchip_number || '—'}</span></div>
      </div>

      <div className="print-section">{t.nextDue}</div>
      {nextDue.length === 0 && <div className="print-empty">{t.noNextDue}</div>}
      {nextDue.map((v) => (
        <div key={v.id} className="print-due">
          <div className="print-bold">{v.vaccine_name}</div>
          <div className="print-muted">{fmt(v.next_due)}</div>
        </div>
      ))}

      <div className="print-section">{t.history}</div>
      {vax.length === 0 && <div className="print-empty">{t.noHistory}</div>}
      {vax.map((v) => (
        <div key={v.id} className="print-rec">
          <div className="print-bold">{v.vaccine_name}</div>
          <div className="print-meta">
            <div><label>{t.dateGiven}</label><span>{fmt(v.date_given)}</span></div>
            <div><label>{t.lotNum}</label><span>{v.lot_number || '—'}</span></div>
            <div><label>{t.nextDueCol}</label><span>{v.next_due && isSuperseded(v) ? t.completed : fmt(v.next_due)}</span></div>
            <div><label>{t.adminBy}</label><span>{v.administered_by || '—'}</span></div>
            {v.rabies_tag_number && <div><label>{t.rabiesTag}</label><span>{v.rabies_tag_number}</span></div>}
          </div>
        </div>
      ))}

      <div className="print-footer">{t.footer}</div>
    </div>
  )
}