import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import HeroArt from './components/HeroArt'
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
    stripBold: 'All services are free of charge.',
    stripRest: ' No insurance needed. All are welcome.',
  },
  es: {
    eyebrow: 'Gratuito · Bilingüe',
    heading1: 'Cuidando mascotas',
    heading2: 'juntos,',
    headingEm: 'con amor.',
    sub: 'Clínicas de vacunas gratuitas para mascotas en nuestra comunidad — porque cada mascota merece un comienzo saludable.',
    register: 'Registra a tu Mascota →',
    stripBold: 'Todos los servicios son gratuitos.',
    stripRest: ' No se necesita seguro. Todos son bienvenidos.',
  },
}

export default function Landing() {
  const { settings } = useSettings()
  // Until a visitor picks a language, use the organization's default
  const [picked, setPicked] = useState<Lang | null>(null)
  const lang: Lang = picked ?? settings.default_language
  const setLang = setPicked
  const c = copy[lang]
  // A simple, generic home page: only the name, logo, city and website come from
  // Settings. Organizations that want more can customize this page.
  const city = cityName(settings)
  const eyebrow = city ? `${c.eyebrow} · ${city}` : c.eyebrow
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
            <p className="hero-sub">{c.sub}</p>
            <div className="hero-ctas">
                <Link to="/registration" className="btn-hero-primary">{c.register}</Link>
            </div>
          </div>
          <div className="hero-img">
            <HeroArt />
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
        {settings.website_url && (
          <div>
            <a href={settings.website_url}>{contact}</a>
          </div>
        )}
      </footer>
    </div>
  )
}