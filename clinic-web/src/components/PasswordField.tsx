import { useState } from 'react'
import './PasswordField.css'

type Props = {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  autoComplete?: 'new-password' | 'current-password'
}

export default function PasswordField({
  id, label, placeholder, value, onChange, autoComplete = 'new-password',
}: Props) {
  const [visible, setVisible] = useState(false)
  const [capsOn, setCapsOn] = useState(false)

  function checkCaps(e: React.KeyboardEvent) {
    setCapsOn(e.getModifierState('CapsLock'))
  }

  return (
    <div className="pw-field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          className="pw-input"
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
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
      {capsOn && <div className="caps-warning">⚠ Caps Lock is on</div>}
    </div>
  )
}