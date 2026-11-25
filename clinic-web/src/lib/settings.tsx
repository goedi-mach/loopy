import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

// Organization settings: name, branding and defaults, stored in the org_settings table
// (one row). Every page reads them through useSettings(), so nothing about a specific
// clinic has to be written into the code.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const CACHE_KEY = 'loopy_settings'

export interface OrgSettings {
  org_name: string
  city_region: string | null
  website_url: string | null
  contact_email: string | null
  logo_url: string | null
  primary_color: string
  accent_color: string
  default_language: 'en' | 'es'
  timezone: string // IANA name, e.g. 'America/Chicago'; used for "today" on the server
}

// Used until the real settings arrive, and if they can't be loaded at all.
// The colors match the ones in index.css.
export const DEFAULT_SETTINGS: OrgSettings = {
  org_name: 'LoopVet',
  city_region: null,
  website_url: null,
  contact_email: null,
  logo_url: null,
  primary_color: '#1a3a8f',
  accent_color: '#f28b82',
  default_language: 'en',
  timezone: 'UTC',
}

// Read with the public (anon) key on purpose: settings are public, and this way a
// stale login on a shared tablet can't bounce the registration page to /login.
async function fetchSettings(): Promise<OrgSettings> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/org_settings?select=*&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(res.statusText)
  const rows = await res.json()
  return { ...DEFAULT_SETTINGS, ...(rows[0] || {}) }
}

// Last settings seen on this device, so the right name and colors show instantly
function cachedSettings(): OrgSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

// Publish the organization's colors as --brand-* CSS variables. The page stylesheets
// use them with a fallback, e.g. --navy: var(--brand-primary, #1a3a8f).
// When a color is still the default, the variables are removed so the exact
// original shades in the stylesheets are used.
const PRIMARY_VARS = ['--brand-primary', '--brand-primary-dark', '--brand-primary-mid', '--brand-primary-light']
const ACCENT_VARS = ['--brand-accent', '--brand-accent-dark', '--brand-accent-light']

function applyTheme(s: OrgSettings) {
  const root = document.documentElement.style
  const p = s.primary_color
  if (p.toLowerCase() === DEFAULT_SETTINGS.primary_color) {
    PRIMARY_VARS.forEach((v) => root.removeProperty(v))
  } else {
    root.setProperty('--brand-primary', p)
    root.setProperty('--brand-primary-dark', `color-mix(in srgb, ${p} 75%, black)`)
    root.setProperty('--brand-primary-mid', `color-mix(in srgb, ${p} 75%, white)`)
    root.setProperty('--brand-primary-light', `color-mix(in srgb, ${p} 15%, white)`)
  }
  const a = s.accent_color
  if (a.toLowerCase() === DEFAULT_SETTINGS.accent_color) {
    ACCENT_VARS.forEach((v) => root.removeProperty(v))
  } else {
    root.setProperty('--brand-accent', a)
    root.setProperty('--brand-accent-dark', `color-mix(in srgb, ${a} 80%, black)`)
    root.setProperty('--brand-accent-light', `color-mix(in srgb, ${a} 18%, white)`)
  }
}

// The latest settings, for code outside React components (PDF builders, etc.)
let current: OrgSettings = cachedSettings()
export const currentSettings = () => current

interface SettingsContextValue {
  settings: OrgSettings
  loaded: boolean
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  reload: async () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OrgSettings>(cachedSettings)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      const s = await fetchSettings()
      current = s
      setSettings(s)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(s))
      } catch {
        /* storage full or blocked: not a problem */
      }
    } catch (err) {
      console.warn('Could not load organization settings:', err)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    applyTheme(settings)
    document.title = `${settings.org_name} - LoopVet`
  }, [settings])

  return <SettingsContext.Provider value={{ settings, loaded, reload }}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)

// The uploaded logo, or the one bundled with the app
export const logoSrc = (s: OrgSettings) => s.logo_url || '/logo.png'

// "Chicago, IL" -> "Chicago"
export const cityName = (s: OrgSettings) => (s.city_region || '').split(',')[0].trim()

// How people can reach the organization: website without https://, else the email
export function contactText(s: OrgSettings): string | null {
  if (s.website_url) return s.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return s.contact_email
}
