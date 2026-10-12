import type { PetFormValues } from './lib/petForm'

interface Props {
  values: PetFormValues
  onChange: (v: PetFormValues) => void
}

export default function PetFields({ values, onChange }: Props) {
  const set = (field: keyof PetFormValues, value: string) => onChange({ ...values, [field]: value })
  const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <>
      <div className="form-row">
        <div className="form-field">
          <label>Pet Name *</label>
          <input value={values.name} onChange={(e) => set('name', titleCase(e.target.value))} placeholder="Fido" />
        </div>
        <div className="form-field">
          <label>Species *</label>
          <select value={values.species} onChange={(e) => set('species', e.target.value)}>
            <option value="">— Select —</option>
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Breed</label>
          <input value={values.breed} onChange={(e) => set('breed', e.target.value)} placeholder="Mixed" />
        </div>
        <div className="form-field">
          <label>Age</label>
          <div className="age-row">
            <input type="number" min="0" max="30" step="0.5" value={values.age} onChange={(e) => set('age', e.target.value)} />
            <select value={values.age_unit} onChange={(e) => set('age_unit', e.target.value)}>
              <option value="years">Years</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Weight (lbs)</label>
          <input type="number" min="0" step="0.1" value={values.weight} onChange={(e) => set('weight', e.target.value)} />
        </div>
        <div className="form-field">
          <label>Sex</label>
          <select value={values.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="unknown">Not sure</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Spayed / Neutered</label>
          <select value={values.altered} onChange={(e) => set('altered', e.target.value)}>
            <option value="unknown">Not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="form-field">
          <label>Microchipped?</label>
          <select value={values.microchipped} onChange={(e) => set('microchipped', e.target.value)}>
            <option value="unknown">Not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Microchip Number</label>
          <input value={values.microchip_number} onChange={(e) => set('microchip_number', e.target.value)} placeholder="985112345678901" />
        </div>
        <div className="form-field">
          <label>Colors / Markings</label>
          <input value={values.colors_markings} onChange={(e) => set('colors_markings', e.target.value)} placeholder="e.g. Black & white, tabby" />
        </div>
      </div>
    </>
  )
}