import { Fragment, useEffect, useState } from 'react'
import { CLINIC_GUIDE, type GuideLang } from '../lib/clinicGuide'
import './HelpButton.css'

const LANG_KEY = 'php_help_lang'

function loadLang(): GuideLang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    // storage unavailable: fall through to the default
  }
  return 'en'
}

// Turns **bold** markers into <strong> elements.
function inline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

export default function HelpButton() {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<GuideLang>(loadLang)
  const guide = CLINIC_GUIDE[lang]

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function pick(next: GuideLang) {
    setLang(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      // ignore: the choice just won't be remembered
    }
  }

  return (
    <>
      {open && <div className="help-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="help-panel" role="dialog" aria-label={guide.title}>
          <div className="help-head">
            <div className="help-title">{guide.title}</div>
            <div className="help-lang" role="group" aria-label={guide.switchLabel}>
              <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => pick('en')}>English</button>
              <button type="button" className={lang === 'es' ? 'active' : ''} onClick={() => pick('es')}>Español</button>
            </div>
            <button type="button" className="help-close" aria-label={guide.close} onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="help-body">
            {guide.sections.map((s) => (
              <section key={s.heading}>
                <h3>{s.heading}</h3>
                {s.intro && <p>{inline(s.intro)}</p>}
                {s.steps && (
                  <ol>
                    {s.steps.map((step, i) => <li key={i}>{inline(step)}</li>)}
                  </ol>
                )}
                {s.table && (
                  <table>
                    <thead>
                      <tr><th>{s.table.head[0]}</th><th>{s.table.head[1]}</th></tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map(([a, b]) => (
                        <tr key={a}><td>{a}</td><td>{inline(b)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {s.note && <p className="help-note">{inline(s.note)}</p>}
              </section>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="help-fab"
        aria-label={open ? guide.close : 'Help / Ayuda'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? '✕' : '?'}
      </button>
    </>
  )
}
