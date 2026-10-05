import { useState } from 'react'

type Props = {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export default function PasswordField({ id, label, placeholder, value, onChange }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          className="pw-input"
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete="new-password"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="toggle-password"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </>
  )
}