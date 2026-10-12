import PetFields from './PetFields'
import type { PetFormValues } from './lib/petForm'

interface Props {
  values: PetFormValues
  onChange: (v: PetFormValues) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  message: string
  saving: boolean
}

export default function PetForm({ values, onChange, onSubmit, onCancel, submitLabel, message, saving }: Props) {
  return (
    <form
      className="pet-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {message && <div className="msg error">{message}</div>}
      <PetFields values={values} onChange={onChange} />
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}