import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { sbGet, sbPatch, sbPost } from './lib/api'
import { loadVaccineTypes, type Duration, type VaccineType } from './lib/vaccines'

// Settings → Vaccines: the vaccine types clinics log (vaccine_types table).
// The key is fixed once created (lots are stored under it). The label is saved at the
// start of every vaccination's name ("DAPP 1 Year") and pets' history is matched on it,
// so renaming a label that has been used is allowed only after a warning.

interface Msg {
  type: 'error' | 'success'
  text: string
}

const SPECIES = [
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
]
const UNITS: Duration['unit'][] = ['weeks', 'months', 'years']
const muted = { color: 'var(--text-muted)' }

const errText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')
const firstWord = (label: string) => label.trim().split(/\s+/)[0].toLowerCase()

// "Feline Leukemia" -> "feline_leukemia", made unique among the existing keys
function makeKey(label: string, taken: string[]) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'vaccine'
  let key = base
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`
  return key
}

// Problems with a label, given the other vaccine types; '' when it's fine
function labelProblem(label: string, others: VaccineType[]) {
  if (!label.trim()) return 'Enter a name for the vaccine.'
  const clash = others.find((o) => firstWord(o.label) === firstWord(label))
  if (clash) return `“${label.trim()}” starts with the same word as “${clash.label}”. Pet histories match vaccines by that first word, so it must be different.`
  return ''
}

// Problems with a list of durations; '' when it's fine
function durationsProblem(list: Duration[]) {
  if (!list.length) return 'Add at least one duration.'
  for (const d of list) {
    if (!d.label.trim()) return 'Every duration needs a name, like “1 Year”.'
    if (!Number.isInteger(d.amount) || d.amount < 1) return `“${d.label}”: the length must be a whole number of 1 or more.`
  }
  const names = list.map((d) => d.label.trim().toLowerCase())
  if (new Set(names).size !== names.length) return 'Two durations have the same name.'
  return ''
}

const summary = (list: Duration[]) => list.map((d) => d.label).join(', ') || '—'

// ── Durations editor (pop-up) ──────────────────────────────────

function DurationsDialog({
  vaccine,
  isRabies,
  initial,
  onDone,
  onCancel,
}: {
  vaccine: string
  isRabies: boolean
  initial: Duration[]
  onDone: (list: Duration[]) => void
  onCancel: () => void
}) {
  const [rows, setRows] = useState<Duration[]>(initial.length ? initial : [{ label: '1 Year', unit: 'years', amount: 1 }])
  const [error, setError] = useState('')

  const update = (i: number, patch: Partial<Duration>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function done() {
    const clean = rows.map((r) => {
      const d: Duration = { label: r.label.trim(), unit: r.unit, amount: Number(r.amount) }
      if (isRabies && r.usda) d.usda = r.usda
      return d
    })
    const problem = durationsProblem(clean)
    if (problem) return setError(problem)
    onDone(clean)
  }

  return (
    <div className="sh-modal-overlay">
      <div className="sh-modal" style={{ maxWidth: 600 }}>
        <div className="sh-modal-title">⏱ Durations for {vaccine || 'new vaccine'}</div>
        <div className="sh-modal-sub">
          The choices when logging this vaccine. The length sets the next due date; the name is saved with the vaccine (e.g. “{vaccine || 'DAPP'} 1 Year”).
        </div>
        {rows.map((r, i) => (
          <div key={i} className="sh-waste-row" style={{ flexWrap: 'wrap' }}>
            <input value={r.label} placeholder="Name, e.g. 1 Year" onChange={(e) => update(i, { label: e.target.value })} />
            <input
              type="number"
              min={1}
              value={Number.isNaN(r.amount) ? '' : r.amount}
              style={{ maxWidth: 80 }}
              onChange={(e) => update(i, { amount: parseInt(e.target.value, 10) })}
            />
            <select value={r.unit} onChange={(e) => update(i, { unit: e.target.value as Duration['unit'] })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            {isRabies && (
              <select value={r.usda || ''} title="USDA license duration on the certificate" onChange={(e) => update(i, { usda: (e.target.value || undefined) as Duration['usda'] })}>
                <option value="">USDA —</option>
                <option value="1yr">USDA 1 yr</option>
                <option value="3yr">USDA 3 yr</option>
              </select>
            )}
            <button type="button" title="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="sh-add-row" onClick={() => setRows([...rows, { label: '', unit: 'years', amount: 1 }])}>
          + Add a duration
        </button>
        {error && <div className="warning-bar" style={{ marginTop: '0.75rem' }}>{error}</div>}
        <div className="sh-modal-actions">
          <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" onClick={done}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── One vaccine ────────────────────────────────────────────────

function VaccineRow({
  vt,
  all,
  onChanged,
  setMsg,
}: {
  vt: VaccineType
  all: VaccineType[]
  onChanged: () => Promise<void>
  setMsg: (m: Msg | null) => void
}) {
  const [label, setLabel] = useState(vt.label)
  const [species, setSpecies] = useState<string[]>(vt.species)
  const [isRabies, setIsRabies] = useState(vt.is_rabies)
  const [durations, setDurations] = useState<Duration[]>(vt.durations)
  const [order, setOrder] = useState(String(vt.sort_order))
  const [editingDurations, setEditingDurations] = useState(false)
  const [busy, setBusy] = useState(false)

  const dirty =
    label.trim() !== vt.label ||
    [...species].sort().join() !== [...vt.species].sort().join() ||
    isRabies !== vt.is_rabies ||
    JSON.stringify(durations) !== JSON.stringify(vt.durations) ||
    Number(order) !== vt.sort_order

  async function patch(data: Partial<VaccineType>) {
    const rows = await sbPatch(`vaccine_types?key=eq.${vt.key}`, data)
    if (!rows.length) throw new Error('Nothing was saved. Only admins can change vaccines.')
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setMsg(null)
    try {
      await action()
      await onChanged()
      setMsg({ type: 'success', text: success })
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const others = all.filter((o) => o.key !== vt.key)
    const problem = labelProblem(label, others) || (species.length ? '' : 'Pick at least one species.') || durationsProblem(durations)
    if (problem) return setMsg({ type: 'error', text: problem })
    if (!Number.isInteger(Number(order))) return setMsg({ type: 'error', text: 'The order must be a whole number.' })

    const newLabel = label.trim()
    if (newLabel !== vt.label) {
      // Renaming a label that's already on vaccination records splits the pet histories
      const used = await sbGet<{ id: string }[]>(
        `vaccinations?select=id&limit=1&vaccine_name=like.${encodeURIComponent(`${vt.label} *`)}`
      ).catch(() => [])
      if (
        used.length &&
        !confirm(
          `Vaccines have already been logged as “${vt.label}”. After renaming, those records keep the old name, ` +
            `so pets' history and what's-due checks won't connect them to “${newLabel}”. Rename anyway?`
        )
      )
        return
    }
    run(
      () =>
        patch({
          label: newLabel,
          species,
          is_rabies: isRabies,
          durations: isRabies ? durations : durations.map(({ usda: _usda, ...d }) => d),
          sort_order: Number(order),
        }),
      `Saved ${newLabel}.`
    )
  }

  const toggleActive = () =>
    run(() => patch({ active: !vt.active }), vt.active ? `${vt.label} can no longer be logged.` : `${vt.label} can be logged again.`)

  return (
    <tr style={vt.active ? undefined : { opacity: 0.6 }}>
      <td>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
        <div style={{ ...muted, fontSize: '0.75rem' }}>key: {vt.key}</div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {SPECIES.map((s) => (
          <label key={s.value} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={species.includes(s.value)}
              onChange={(e) => setSpecies(e.target.checked ? [...species, s.value] : species.filter((x) => x !== s.value))}
            />{' '}
            {s.label}
          </label>
        ))}
      </td>
      <td>
        <input type="checkbox" checked={isRabies} title="Shows the rabies-certificate fields" onChange={(e) => setIsRabies(e.target.checked)} />
      </td>
      <td>
        <div>{summary(durations)}</div>
        <button type="button" className="btn-link" onClick={() => setEditingDurations(true)}>Edit</button>
        {editingDurations && (
          <DurationsDialog
            vaccine={label.trim()}
            isRabies={isRabies}
            initial={durations}
            onCancel={() => setEditingDurations(false)}
            onDone={(list) => {
              setDurations(list)
              setEditingDurations(false)
            }}
          />
        )}
      </td>
      <td><input type="number" value={order} style={{ maxWidth: 70 }} onChange={(e) => setOrder(e.target.value)} /></td>
      <td>{vt.active ? 'Active' : <span style={muted}>Inactive</span>}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {dirty && (
          <button type="button" className="btn-outline" disabled={busy} onClick={save}>Save</button>
        )}{' '}
        <button type="button" className="btn-outline" disabled={busy} onClick={toggleActive}>
          {vt.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </td>
    </tr>
  )
}

// ── The section ────────────────────────────────────────────────

const emptyNew = { label: '', species: ['dog'] as string[], isRabies: false }

export default function VaccineTypesSettings() {
  const [types, setTypes] = useState<VaccineType[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [msg, setMsg] = useState<Msg | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(emptyNew)
  const [draftDurations, setDraftDurations] = useState<Duration[]>([{ label: '1 Year', unit: 'years', amount: 1 }])
  const [editingDraft, setEditingDraft] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setTypes(await loadVaccineTypes(true))
      setLoadError('')
    } catch (err) {
      setLoadError(errText(err))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function add(e: FormEvent) {
    e.preventDefault()
    const list = types || []
    const problem =
      labelProblem(draft.label, list) || (draft.species.length ? '' : 'Pick at least one species.') || durationsProblem(draftDurations)
    if (problem) return setMsg({ type: 'error', text: problem })
    setAdding(true)
    setMsg(null)
    try {
      const label = draft.label.trim()
      await sbPost('vaccine_types', {
        key: makeKey(label, list.map((t) => t.key)),
        label,
        species: draft.species,
        is_rabies: draft.isRabies,
        durations: draft.isRabies ? draftDurations : draftDurations.map(({ usda: _usda, ...d }) => d),
        sort_order: Math.max(0, ...list.map((t) => t.sort_order)) + 10,
      })
      setMsg({ type: 'success', text: `Added ${label}. Add a lot for it on Staff Home before logging it.` })
      setDraft(emptyNew)
      setDraftDurations([{ label: '1 Year', unit: 'years', amount: 1 }])
      await refresh()
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <div className="sh-section sh-section-gap">Vaccines</div>
      {msg && <div className={msg.type === 'error' ? 'warning-bar' : 'sh-success'}>{msg.text}</div>}
      <div className="card">
        <div className="card-body">
          <p style={{ ...muted, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            The vaccines your clinic gives. Active vaccines appear when logging, in “Give at next clinic”, in lots and in
            waste. Each vaccine is checked in a pet&apos;s what&apos;s-due list for the species it&apos;s given to. Checking
            “Rabies” shows the rabies-certificate fields. Deactivate a vaccine instead of deleting it; its history stays.
          </p>
          {loadError && <div className="warning-bar">Error: {loadError}</div>}
          {!types && !loadError && <div className="state-msg">Loading vaccines…</div>}
          {types && types.length > 0 && (
            <div className="table-wrap">
              <table className="rec-table">
                <thead>
                  <tr><th>Name</th><th>Given to</th><th>Rabies</th><th>Durations</th><th>Order</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {types.map((t) => (
                    // The key changes after a save, so the row starts from the saved values
                    <VaccineRow key={`${t.key}|${JSON.stringify(t)}`} vt={t} all={types} onChanged={refresh} setMsg={setMsg} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={add} style={{ marginTop: '1rem' }}>
            <div className="sh-add-title">➕ Add a Vaccine</div>
            <div className="sh-row">
              <div className="sh-field">
                <label>Name</label>
                <input value={draft.label} placeholder="e.g. Bordetella" onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              </div>
              <div className="sh-field">
                <label>Given to</label>
                <div>
                  {SPECIES.map((s) => (
                    <label key={s.value} style={{ marginRight: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={draft.species.includes(s.value)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            species: e.target.checked ? [...draft.species, s.value] : draft.species.filter((x) => x !== s.value),
                          })
                        }
                      />{' '}
                      {s.label}
                    </label>
                  ))}
                  <label>
                    <input type="checkbox" checked={draft.isRabies} onChange={(e) => setDraft({ ...draft, isRabies: e.target.checked })} /> Rabies
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              Durations: {summary(draftDurations)}{' '}
              <button type="button" className="btn-link" onClick={() => setEditingDraft(true)}>Edit</button>
            </div>
            {editingDraft && (
              <DurationsDialog
                vaccine={draft.label.trim()}
                isRabies={draft.isRabies}
                initial={draftDurations}
                onCancel={() => setEditingDraft(false)}
                onDone={(list) => {
                  setDraftDurations(list)
                  setEditingDraft(false)
                }}
              />
            )}
            <button type="submit" className="btn-primary" disabled={adding}>{adding ? 'Adding…' : 'Add Vaccine'}</button>
          </form>
        </div>
      </div>
    </>
  )
}
