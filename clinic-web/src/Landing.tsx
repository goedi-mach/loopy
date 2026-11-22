import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cityName, contactText, logoSrc, useSettings } from './lib/settings'
import './Landing.css'

type Lang = 'en' | 'es'

const copy = {
  en: {
    eyebrow: 'Free · Bilingual',
    heading1: 'Keeping pets',
    heading2: 'healthy,',
    headingEm: 'together.',
    sub: 'Free vaccine clinics for pets in our community — because every pet deserves a healthy start.',
    register: 'Register Your Pet →',
    clinics: 'See Upcoming Clinics',
    stripBold: 'All services are free of charge.',
    stripRest: ' No insurance needed. All are welcome.',
    footerClinics: 'Upcoming Clinics',
  },
  es: {
    eyebrow: 'Gratuito · Bilingüe',
    heading1: 'Cuidando mascotas',
    heading2: 'juntos,',
    headingEm: 'con amor.',
    sub: 'Clínicas de vacunas gratuitas para mascotas en nuestra comunidad — porque cada mascota merece un comienzo saludable.',
    register: 'Registra a tu Mascota →',
    clinics: 'Ver Próximas Clínicas',
    stripBold: 'Todos los servicios son gratuitos.',
    stripRest: ' No se necesita seguro. Todos son bienvenidos.',
    footerClinics: 'Próximas Clínicas',
  },
}

export default function Landing() {
  const { settings } = useSettings()
  // Until a visitor picks a language, use the organization's default
  const [picked, setPicked] = useState<Lang | null>(null)
  const lang: Lang = picked ?? settings.default_language
  const setLang = setPicked
  const c = copy[lang]
  // Organization-specific text from Settings, falling back to the generic text above
  const city = cityName(settings)
  const eyebrow = city ? `${c.eyebrow} · ${city}` : c.eyebrow
  const intro = (lang === 'es' ? settings.intro_es : settings.intro_en) || c.sub
  const tagline = lang === 'es' ? settings.tagline_es : settings.tagline_en
  const contact = contactText(settings)

  // Keep the page's language attribute in sync with the toggle
  useEffect(() => {
    document.documentElement.lang = lang
    return () => {
      document.documentElement.lang = 'en'
    }
  }, [lang])

  // Supabase invite / password-reset links land here with the token after the #.
  // Forward them to the page named in redirect_to, but only on our own site.
  useEffect(() => {
    const redirectTo = new URLSearchParams(window.location.search).get('redirect_to')
    const hash = window.location.hash
    if (!redirectTo || !hash) return
    try {
      const target = new URL(redirectTo, window.location.origin)
      if (target.origin === window.location.origin) {
        window.location.replace(target.href + hash)
      }
    } catch {
      // ignore malformed redirect_to values
    }
  }, [])

  return (
    <div className="landing">
      <nav>
        <Link to="/" className="nav-brand">
          <img src={logoSrc(settings)} alt={`${settings.org_name} logo`} />
          {settings.org_name}
        </Link>
        <div className="nav-right">
          <div className="lang-toggle">
            <button
              type="button"
              className={lang === 'en' ? 'lang-btn active' : 'lang-btn'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={lang === 'es' ? 'lang-btn active' : 'lang-btn'}
              onClick={() => setLang('es')}
            >
              ES
            </button>
          </div>
          <Link to="/login" className="btn-nav">Staff Login</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-eyebrow">{eyebrow}</span>
            <h1>
              {c.heading1}
              <br />
              {c.heading2} <em>{c.headingEm}</em>
            </h1>
            <p className="hero-sub">{intro}</p>
            <div className="hero-ctas">
                <Link to="/registration" className="btn-hero-primary">{c.register}</Link>
              {settings.events_url && (
                <a href={settings.events_url} className="btn-hero-secondary">
                  {c.clinics}
                </a>
              )}
            </div>
          </div>
          <div className="hero-img">
            <img src="/hero.png" alt="" />
          </div>
        </div>
      </section>

      <div className="bilingual-strip">
        <strong>{c.stripBold}</strong>
        {c.stripRest}
      </div>

      <footer>
        <div className="footer-brand">
          <strong>{settings.org_name}</strong>
          {settings.city_region && <> — {settings.city_region}</>}
        </div>
        <div>
          {[
            tagline && <span key="t">{tagline}</span>,
            settings.events_url && <a key="e" href={settings.events_url}>{c.footerClinics}</a>,
            settings.website_url && <a key="w" href={settings.website_url}>{contact}</a>,
          ]
            .filter(Boolean)
            .map((part, i) => (
              <span key={i}>
                {i > 0 && <> &nbsp;·&nbsp; </>}
                {part}
              </span>
            ))}
        </div>
      </footer>
    </div>
  )
}