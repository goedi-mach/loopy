import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Landing.css'

type Lang = 'en' | 'es'

const copy = {
  en: {
    eyebrow: 'Free · Bilingual · Chicago',
    heading1: 'Keeping pets',
    heading2: 'healthy,',
    headingEm: 'together.',
    sub: "People Helping Pets brings free vaccine clinics to Chicago's underserved neighborhoods — because every pet deserves a healthy start.",
    register: 'Register Your Pet →',
    clinics: 'See Upcoming Clinics',
    stripBold: 'All services are free of charge.',
    stripRest: ' No insurance needed. All are welcome.',
    tagline: 'Helping Pets, Empowering Families',
    footerClinics: 'Upcoming Clinics',
  },
  es: {
    eyebrow: 'Gratuito · Bilingüe · Chicago',
    heading1: 'Cuidando mascotas',
    heading2: 'juntos,',
    headingEm: 'con amor.',
    sub: 'People Helping Pets lleva clínicas de vacunas gratuitas a los vecindarios de Chicago que más lo necesitan — porque cada mascota merece un comienzo saludable.',
    register: 'Registra a tu Mascota →',
    clinics: 'Ver Próximas Clínicas',
    stripBold: 'Todos los servicios son gratuitos.',
    stripRest: ' No se necesita seguro. Todos son bienvenidos.',
    tagline: 'Ayudando Mascotas, Empoderando Familias',
    footerClinics: 'Próximas Clínicas',
  },
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>('en')
  const c = copy[lang]

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
          <img src="/logo.png" alt="PHP logo" />
          PHP Clinic HQ
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
            <span className="hero-eyebrow">{c.eyebrow}</span>
            <h1>
              {c.heading1}
              <br />
              {c.heading2} <em>{c.headingEm}</em>
            </h1>
            <p className="hero-sub">{c.sub}</p>
            <div className="hero-ctas">
              <a href="/registration.html" className="btn-hero-primary">{c.register}</a>
              <a href="https://peoplehelpingpets.org/upcoming-clinics/" className="btn-hero-secondary">
                {c.clinics}
              </a>
            </div>
          </div>
          <div className="hero-img">
            <img src="/hero.png" alt="People Helping Pets" />
          </div>
        </div>
      </section>

      <div className="bilingual-strip">
        <strong>{c.stripBold}</strong>
        {c.stripRest}
      </div>

      <footer>
        <div className="footer-brand">
          <strong>People Helping Pets</strong> — Chicago, IL
        </div>
        <div>
          {c.tagline} &nbsp;·&nbsp;
          <a href="https://peoplehelpingpets.org/events/">{c.footerClinics}</a> &nbsp;·&nbsp;
          <a href="https://peoplehelpingpets.org">peoplehelpingpets.org</a>
        </div>
      </footer>
    </div>
  )
}