import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import ClinicNav from './components/ClinicNav'
import { sbGet, sbPost } from './lib/api'
import './Intake.css'

interface MClient {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  event_date: string | null
  notes: string | null
}

interface MPet {
  id: string
  name: string
  species: string | null
  breed: string | null
  archived: boolean | null
}

type FieldKey = 'name' | 'phone' | 'email' | 'street' | 'city' | 'state' | 'zip' | 'event_date'
type Slot = 'a' | 'b'

const FIELDS: { label: string; key: FieldKey }[] = [
  { label: 'Name', key: 'name' },
  { label: 'Phone', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'Street', key: 'street' },
  { label: 'City', key: 'city' },
  { label: 'State', key: 'state' },
  { label: 'ZIP', key: 'zip' },
  { label: 'Clinic Date', key: 'event_date' },
]

const NOTE_SEP = '\n\n---\n\n'
const contact = (c: MClient) => [c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'
const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const show = (key: FieldKey, v: string) => (key === 'event_date' && v ? fmtDate(v) : v)
const petIcon = (s: string | null) => (s?.toLowerCase() === 'cat' ? '🐱' : s?.toLowerCase() === 'dog' ? '🐶' : '🐾')
const loadPets = async (id: string): Promise<MPet[]> => sbGet(`pets?client_id=eq.${id}&order=name.asc`)

export default function MergeClients() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MClient[]>([])
  const [searched, setSearched] = useState(false)
  const [a, setA] = useState<MClient | null>(null)
  const [b, setB] = useState<MClient | null>(null)
  const [petsA, setPetsA] = useState<MPet[]>([])
  const [petsB, setPetsB] = useState<MPet[]>([])
  const [choices, setChoices] = useState<Partial<Record<FieldKey, Slot>>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  const chosen = (key: FieldKey) => ((choices[key] === 'b' ? b : a)?.[key] as string | null) || ''
  const notesA = (a?.notes || '').trim()
  const notesB = (b?.notes || '').trim()
  const combinedNotes = [notesA, notesB].filter(Boolean).join(NOTE_SEP)

  async function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return setMsg('Enter a name, phone, or email to search.')
    setMsg('')
    setBusy(true)
    try {
      const rows: MClient[] = await sbGet(`rpc/search_clients_unaccent?search_term=${encodeURIComponent(q)}`)
      setResults(rows)
      setSearched(true)
    } catch (err) {
      setMsg(`Search failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  function pick(slot: Slot, c: MClient) {
    if (slot === 'a') {
      if (b?.id === c.id) setB(null)
      setA(c)
    } else {
      if (a?.id === c.id) setA(null)
      setB(c)
    }
  }

  async function goToStep2() {
    if (!a || !b) return
    setBusy(true)
    setMsg('')
    try {
      const [pa, pb] = await Promise.all([loadPets(a.id), loadPets(b.id)])
      setPetsA(pa)
      setPetsB(pb)
      // Start with whichever side has a value; if both do, keep A's
      const next: Partial<Record<FieldKey, Slot>> = {}
      FIELDS.forEach(({ key }) => {
        next[key] = !a[key] && b[key] ? 'b' : 'a'
      })
      setChoices(next)
      setStep(2)
    } catch (err) {
      setMsg(`Failed to load pets: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  async function executeMerge() {
    if (!a || !b) return
    setBusy(true)
    try {
      const fields = Object.fromEntries(FIELDS.map(({ key }) => [key, chosen(key) || null]))
      await sbPost('rpc/merge_clients', { keep_id: a.id, drop_id: b.id, fields })
      const n = petsB.length
      setDoneMsg(
        `"${b.name}" was merged into "${chosen('name') || a.name}". ` +
          (n ? `${n} pet${n === 1 ? '' : 's'} moved over.` : '')
      )
      setStep(3)
    } catch (err) {
      setMsg(`Merge failed: ${err instanceof Error ? err.message : 'unknown error'}. Nothing was changed.`)
    } finally {
      setConfirming(false)
      setBusy(false)
    }
  }

  function reset() {
    setStep(1)
    setQuery('')
    setResults([])
    setSearched(false)
    setA(null)
    setB(null)
    setPetsA([])
    setPetsB([])
    setChoices({})
    setMsg('')
    setDoneMsg('')
  }

  const steps = ['Find duplicates', 'Choose what to keep', 'Done']

  return (
    <div className="intake">
      <ClinicNav active="merge" />
      <div className="records-main">
        <div className="page-title">🔀 Merge Duplicate Clients</div>
        <div className="bc-sub" style={{ marginBottom: '1.25rem' }}>
          Find two duplicate client records, choose which data to keep field-by-field, then merge them into one.
        </div>

        <div className="mc-steps">
          {steps.map((label, i) => {
            const n = i + 1
            const cls = n === step ? 'mc-step active' : n < step ? 'mc-step done' : 'mc-step'
            return (
              <div key={label} className="mc-step-wrap">
                <div className={cls}>
                  <span className="mc-num">{n < step ? '✓' : n}</span>
                  <span>{label}</span>
                </div>
                {n < 3 && <span className="mc-divider" />}
              </div>
            )
          })}
        </div>

        {step === 1 && (
          <div className="card">
            <div className="card-header"><span>🔍 Search for Clients</span></div>
            <div className="card-body">
              <p className="field-note">
                Search by name, phone, or email. Select one client as <strong style={{ color: 'var(--navy)' }}>Client A</strong> (kept) and one as{' '}
                <strong style={{ color: 'var(--coral-dark, #d96b62)' }}>Client B</strong> (deleted after merging).
              </p>
              <form className="mc-search" onSubmit={search}>
                <input type="text" value={query} placeholder="Name, phone, or email…" onChange={(e) => setQuery(e.target.value)} />
                <button type="submit" className="btn-primary btn-small" disabled={busy}>Search</button>
              </form>

              {msg && <div className="warning-bar">{msg}</div>}
              {searched && results.length === 0 && <div className="empty-state">No clients found. Try a different search term.</div>}

              <div className="mc-results">
                {results.map((c) => {
                  const isA = a?.id === c.id
                  const isB = b?.id === c.id
                  return (
                    <div key={c.id} className={`mc-result${isA ? ' sel-a' : ''}${isB ? ' sel-b' : ''}`}>
                      <div style={{ minWidth: 0 }}>
                        <div className="mc-result-name">
                          {c.name || '—'}
                          {isA && <span className="mc-badge a">A</span>}
                          {isB && <span className="mc-badge b">B</span>}
                        </div>
                        <div className="bc-sub">
                          {contact(c)}
                          {c.event_date ? ` · Clinic: ${fmtDate(c.event_date)}` : ''}
                        </div>
                      </div>
                      <div className="mc-result-actions">
                        <button type="button" className="sh-mini navy" disabled={isA} onClick={() => pick('a', c)}>
                          {isA ? '✓ Client A' : 'Set as A'}
                        </button>
                        <button type="button" className="sh-mini red" disabled={isB} onClick={() => pick('b', c)}>
                          {isB ? '✓ Client B' : 'Set as B'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {(a || b) && (
                <div className="mc-selected">
                  <div className="mc-summary">
                    <div className="mc-sel a">
                      <div className="mc-sel-label">Client A (will be kept)</div>
                      <div className="mc-sel-name">{a?.name || '—'}</div>
                      <div className="bc-sub">{a ? contact(a) : '—'}</div>
                    </div>
                    <div className="mc-arrow">→</div>
                    <div className="mc-sel b">
                      <div className="mc-sel-label">Client B (will be deleted)</div>
                      <div className="mc-sel-name">{b?.name || '—'}</div>
                      <div className="bc-sub">{b ? contact(b) : '—'}</div>
                    </div>
                  </div>
                  <div className="mc-row">
                    <button type="button" className="btn-primary" disabled={!a || !b || busy} onClick={goToStep2}>
                      {busy ? 'Loading…' : 'Continue →'}
                    </button>
                    <button type="button" className="btn-outline" onClick={() => { setA(null); setB(null) }}>Clear selections</button>
                    <span className="bc-sub">Both clients must be selected to continue.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && a && b && (
          <div className="card">
            <div className="card-header"><span>✏️ Choose What to Keep</span></div>
            <div className="card-body">
              <p className="field-note">
                Click a value to select it for the merged record. The result column shows what will be saved. All pets, documents and
                email history from both records are kept.
              </p>

              <div className="table-wrap">
                <table className="mc-table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Field</th>
                      <th className="a">🔵 Client A <em>({a.name})</em></th>
                      <th className="b">🔴 Client B <em>({b.name})</em></th>
                      <th className="r">✅ Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map(({ label, key }) => {
                      const va = (a[key] as string | null) || ''
                      const vb = (b[key] as string | null) || ''
                      const res = chosen(key)
                      return (
                        <tr key={key}>
                          <td className="mc-field">{label}</td>
                          <td>
                            <button
                              type="button"
                              className={`mc-opt${!va ? ' empty' : ''}${choices[key] === 'a' ? ' sel-a' : ''}`}
                              disabled={!va}
                              onClick={() => setChoices({ ...choices, [key]: 'a' })}
                            >
                              {va ? show(key, va) : '(empty)'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`mc-opt${!vb ? ' empty' : ''}${choices[key] === 'b' ? ' sel-b' : ''}`}
                              disabled={!vb}
                              onClick={() => setChoices({ ...choices, [key]: 'b' })}
                            >
                              {vb ? show(key, vb) : '(empty)'}
                            </button>
                          </td>
                          <td>
                            <div className={`mc-preview${res ? '' : ' empty'}`}>{res ? show(key, res) : '(empty)'}</div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mc-section">
                <div className="mc-section-title">🐾 Pets — all pets from both records will be kept</div>
                <div className="mc-pets">
                  {petsA.length + petsB.length === 0 && <span className="bc-sub">No pets on either record.</span>}
                  {[...petsA.map((p) => ({ ...p, src: 'a' })), ...petsB.map((p) => ({ ...p, src: 'b' }))].map((p) => (
                    <div key={p.id} className={`mc-pill ${p.src}`} style={p.archived ? { opacity: 0.55 } : undefined}>
                      {petIcon(p.species)} {p.name}
                      {p.breed ? ` · ${p.breed}` : ''}
                      {p.archived ? ' (archived)' : ''}
                    </div>
                  ))}
                </div>
              </div>

              {combinedNotes && (
                <div className="mc-section">
                  <div className="mc-section-title">📝 Client Notes</div>
                  <p className="bc-sub">Notes from both clients will be combined (A first, then B).</p>
                  <div className="mc-notes">{combinedNotes}</div>
                </div>
              )}

              {msg && <div className="warning-bar">{msg}</div>}

              <div className="mc-footer">
                <div className="bc-sub" style={{ maxWidth: 520 }}>
                  <strong style={{ color: 'var(--coral-dark, #d96b62)' }}>What happens when you merge:</strong> Client A's record is
                  updated with your chosen fields. Everything attached to Client B (pets, documents, email history) moves to Client A,
                  and Client B is permanently deleted. It all happens at once, so a failure changes nothing.
                </div>
                <div className="mc-row">
                  <button type="button" className="btn-outline" onClick={() => { setMsg(''); setStep(1) }}>← Back</button>
                  <button type="button" className="mc-danger" onClick={() => setConfirming(true)}>Merge Clients →</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && a && (
          <div className="card">
            <div className="card-body mc-success">
              <div style={{ fontSize: '3rem' }}>✅</div>
              <div className="mc-success-title">Clients merged successfully!</div>
              <div className="bc-sub" style={{ margin: '0.5rem 0 1.5rem', fontSize: '0.9rem' }}>{doneMsg}</div>
              <div className="mc-row" style={{ justifyContent: 'center' }}>
                <Link to={`/client/${a.id}`} className="btn-primary" style={{ textDecoration: 'none' }}>View merged client →</Link>
                <button type="button" className="btn-outline" onClick={reset}>Merge another</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirming && a && b && (
        <div className="sh-modal-overlay">
          <div className="sh-modal">
            <div className="sh-modal-title">⚠️ Confirm merge</div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>You're about to merge these two clients into one:</p>
            <ul style={{ margin: '0.5rem 0 0.75rem 1.1rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
              <li><strong>{a.name}</strong> (Client A: record will be updated)</li>
              <li><strong>{b.name}</strong> (Client B: will be permanently deleted)</li>
            </ul>
            <p style={{ fontSize: '0.9rem' }}>
              All of Client B's pets ({petsB.length}), documents and email history move to the merged record. This cannot be undone.
            </p>
            <div className="sh-modal-actions">
              <button type="button" className="btn-outline" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="mc-danger" disabled={busy} onClick={executeMerge}>
                {busy ? 'Merging…' : 'Merge & delete duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}