import { useEffect, useRef, useState, type ReactNode } from 'react'
import SignaturePad from 'signature_pad'
import { emptyPet, type PetFormValues } from './lib/petForm'
import './Registration.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const MAX_PETS = 3

// Keep in sync with the waiver text in lib/waiverPdf.ts
const WAIVER_EN = [
  'I, the undersigned, am using the medical services provided by People Helping Pets ("Clinic"). I understand that the Clinic is community-based and may include volunteer veterinarians, veterinary technicians, assistants, students, managers, and helpers.',
  'I confirm that I am at least 18 years old and am legally authorized to make decisions for the animal(s) I am presenting today. I authorize the Clinic and its representatives to examine, vaccinate, microchip, and provide any other services I select or that are considered necessary.',
  'I understand that these services do not replace full veterinary care and that the Clinic is not a full-service veterinary hospital. I am responsible for seeking and paying for any additional care recommended for my pet. I will inform Clinic staff, to the best of my knowledge, of any preexisting medical conditions, and I understand that some conditions may prevent my pet from receiving services.',
  'I understand that vaccines and other services carry some risk. Mild side effects can include soreness, lethargy, or fever, while serious reactions are rare but possible and may require immediate veterinary attention.',
  'I release and hold harmless People Helping Pets, including its directors, officers, volunteers, veterinarians, staff, and representatives, from liability for any injury, harm, or damage to me, my pet, or my personal property related to services provided at the Clinic.',
  'I understand that photos or videos may be taken at Clinic events, and I give permission for People Helping Pets to use images of me, my pet, or others accompanying me for educational or promotional purposes. Anyone who does not wish to be photographed should let staff know at check-in.',
  'I agree to receive email reminders from People Helping Pets regarding upcoming vaccinations for my pet(s). These reminders are sent as a courtesy and do not replace my responsibility to seek timely veterinary care.',
]
const WAIVER_ES = [
  'Yo, la persona abajo firmante, estoy utilizando los servicios médicos proporcionados por People Helping Pets ("la Clínica"). Entiendo que la Clínica es comunitaria y puede incluir veterinarios voluntarios, técnicos veterinarios, asistentes, estudiantes, administradores y ayudantes.',
  'Confirmo que tengo al menos 18 años de edad y que estoy legalmente autorizado(a) para tomar decisiones por el/los animal(es) que presento hoy. Autorizo a la Clínica y a sus representantes a examinar, vacunar, colocar microchip y proporcionar cualquier otro servicio que seleccione o que se considere necesario.',
  'Entiendo que estos servicios no reemplazan la atención veterinaria completa y que la Clínica no es un hospital veterinario de servicio completo. Soy responsable de buscar y pagar cualquier atención adicional recomendada para mi mascota. Informaré al personal de la Clínica, según mi conocimiento, sobre cualquier condición médica preexistente, y entiendo que algunas condiciones pueden impedir que mi mascota reciba ciertos servicios.',
  'Entiendo que las vacunas y otros servicios conllevan algunos riesgos. Los efectos secundarios leves pueden incluir dolor en el sitio de aplicación, letargo o fiebre, mientras que las reacciones graves son poco comunes pero posibles y pueden requerir atención veterinaria inmediata.',
  'Libero y eximo de responsabilidad a People Helping Pets, incluyendo a sus directores, oficiales, voluntarios, veterinarios, personal y representantes, por cualquier lesión, daño o perjuicio a mí, a mi mascota o a mi propiedad personal relacionado con los servicios proporcionados en la Clínica.',
  'Entiendo que se pueden tomar fotos o videos durante los eventos de la Clínica, y doy permiso a People Helping Pets para utilizar imágenes mías, de mi mascota o de cualquier persona que me acompañe con fines educativos o promocionales. Las personas que no deseen ser fotografiadas deben informar al personal al momento del registro.',
  'Acepto recibir recordatorios por correo electrónico de People Helping Pets sobre las vacunas próximas de mi(s) mascota(s). Estos recordatorios se envían como cortesía y no reemplazan mi responsabilidad de buscar atención veterinaria oportuna.',
]

const emptyClient = { name: '', email: '', phone: '', street: '', city: '', state: '', zip: '', preferred_language: '' }

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

function Field({ en, es, required, children }: { en: string; es: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="reg-field">
      <span className="lbl">
        {en} / <span className="es">{es}</span>
        {required && <span className="req">*</span>}
      </span>
      {children}
    </label>
  )
}

export default function Registration() {
  const [client, setClient] = useState(emptyClient)
  const [pets, setPets] = useState<PetFormValues[]>([{ ...emptyPet }])
  const [active, setActive] = useState(0)
  const [waiverLang, setWaiverLang] = useState<'en' | 'es'>('en')
  const [website, setWebsite] = useState('') // hidden bot trap: real people never fill it
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [signed, setSigned] = useState(false)
  const [sigError, setSigError] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  // (Re)build the signature pad whenever the form is on screen
  useEffect(() => {
    if (done) return
    const canvas = canvasRef.current
    if (!canvas) return
    let lastWidth = 0

    function size() {
      if (!canvas || canvas.offsetWidth === lastWidth) return // ignore height-only resizes (phone address bars)
      lastWidth = canvas.offsetWidth
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      padRef.current?.clear()
      setSigned(false)
    }

    const pad = new SignaturePad(canvas, { penColor: '#1a1a2e', minWidth: 1, maxWidth: 2.5 })
    padRef.current = pad
    pad.addEventListener('endStroke', () => {
      setSigned(true)
      setSigError(false)
    })
    size()
    window.addEventListener('resize', size)
    return () => {
      window.removeEventListener('resize', size)
      pad.off()
    }
  }, [done])

  const setC = (field: keyof typeof emptyClient, value: string) => setClient((c) => ({ ...c, [field]: value }))
  const setP = (i: number, field: keyof PetFormValues, value: string) =>
    setPets((ps) => ps.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))

  function addPet() {
    if (pets.length >= MAX_PETS) return
    setPets((ps) => [...ps, { ...emptyPet }])
    setActive(pets.length)
  }

  function fail(en: string, es: string) {
    setError(`${en}\n${es}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (website) {
      setDone(true) // a bot filled the hidden field: pretend it worked, save nothing
      return
    }
    if (!client.name.trim()) return fail('Please enter your name.', 'Por favor ingrese su nombre.')
    if (!client.preferred_language) return fail('Please select your preferred language.', 'Por favor seleccione su idioma preferido.')
    const filled = pets.filter((p) => p.name.trim())
    if (!filled.length) return fail("Please enter at least one pet's name.", 'Ingrese el nombre de al menos una mascota.')
    if (filled.some((p) => !p.species)) return fail('Please select a species for each pet.', 'Seleccione la especie de cada mascota.')
    const pad = padRef.current
    if (!pad || pad.isEmpty()) {
      setSigError(true)
      return fail('Please sign the waiver before submitting.', 'Por favor firme la exención antes de enviar.')
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        client: {
          name: client.name.trim(),
          email: client.email.trim() || null,
          phone: client.phone.trim() || null,
          street: client.street.trim() || null,
          city: client.city.trim() || null,
          state: client.state.trim().toUpperCase() || null,
          zip: client.zip.trim() || null,
          preferred_language: client.preferred_language,
          waiver_signature: pad.toDataURL('image/png'),
        },
        pets: filled.map((p) => ({
          name: p.name.trim(),
          species: p.species,
          breed: p.breed.trim() || null,
          age: p.age ? +p.age : null,
          age_unit: p.age_unit || 'years',
          weight: p.weight ? +p.weight : null,
          sex: p.sex,
          altered: p.altered,
          microchipped: p.microchipped,
          colors_markings: p.colors_markings.trim() || null,
        })),
      }
      // Public page: anon key only, never the signed-in token (an expired one would log staff out)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ payload }),
      })
      if (!res.ok) {
        console.error('Registration failed', res.status, await res.text().catch(() => ''))
        throw new Error('failed')
      }
      setClient(emptyClient)
      setPets([{ ...emptyPet }])
      setActive(0)
      setDone(true)
      window.scrollTo({ top: 0 })
    } catch {
      fail('Something went wrong. Please try again, or ask a volunteer for help.', 'Algo salió mal. Intente de nuevo o pida ayuda a un voluntario.')
    } finally {
      setSubmitting(false)
    }
  }

  const header = (
    <header className="reg-header">
      <img className="reg-logo" src="/logo.png" alt="People Helping Pets logo" />
      <h1>
        Vaccine Clinic Registration
        <span className="sub">Registro para Clínica de Vacunas</span>
      </h1>
      <p className="org">People Helping Pets</p>
    </header>
  )

  if (done) {
    return (
      <div className="registration">
        {header}
        <main>
          <div className="reg-card reg-done">
            <div className="big">✅</div>
            <h2>Registration complete! / ¡Registro completo!</h2>
            <p>Thank you. Please let a volunteer know you are finished.<br /><em>Gracias. Avise a un voluntario que terminó.</em></p>
            <button type="button" className="reg-submit" onClick={() => setDone(false)}>
              Register another person / Registrar a otra persona
            </button>
          </div>
        </main>
      </div>
    )
  }

  const pet = pets[active]
  const waiver = waiverLang === 'en' ? WAIVER_EN : WAIVER_ES

  return (
    <div className="registration">
      {header}
      <main>
        {error && <div className="reg-error" role="alert">{error}</div>}

        <form onSubmit={submit} noValidate>
          <div className="reg-hp" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>

          <div className="reg-card">
            <div className="reg-title">👤 Your Information / Su Información</div>
            <Field en="Full Name" es="Nombre Completo" required>
              <input value={client.name} placeholder="Jane Doe" autoComplete="name" onChange={(e) => setC('name', e.target.value)} />
            </Field>
            <div className="reg-row">
              <Field en="Email" es="Correo Electrónico">
                <input type="email" value={client.email} placeholder="correo@ejemplo.com" autoComplete="email" onChange={(e) => setC('email', e.target.value)} />
              </Field>
              <Field en="Phone" es="Teléfono">
                <input type="tel" value={client.phone} placeholder="(773) 555-0100" autoComplete="tel" onChange={(e) => setC('phone', e.target.value)} />
              </Field>
            </div>
            <Field en="Street Address" es="Dirección">
              <input value={client.street} placeholder="1234 W Cermak Rd" autoComplete="street-address" onChange={(e) => setC('street', e.target.value)} />
            </Field>
            <div className="reg-row three">
              <Field en="City" es="Ciudad">
                <input value={client.city} placeholder="Chicago" autoComplete="address-level2" onChange={(e) => setC('city', e.target.value)} />
              </Field>
              <Field en="State" es="Estado">
                <input value={client.state} placeholder="IL" maxLength={2} style={{ textTransform: 'uppercase' }} autoComplete="address-level1" onChange={(e) => setC('state', e.target.value)} />
              </Field>
              <Field en="ZIP Code" es="Código Postal">
                <input value={client.zip} placeholder="60608" maxLength={10} autoComplete="postal-code" onChange={(e) => setC('zip', e.target.value)} />
              </Field>
            </div>
            <div className="reg-field">
              <div className="lbl">Preferred Language / <span className="es">Idioma Preferido</span><span className="req">*</span></div>
              <div className="reg-radios">
                <label><input type="radio" name="lang" checked={client.preferred_language === 'en'} onChange={() => setC('preferred_language', 'en')} /> English</label>
                <label><input type="radio" name="lang" checked={client.preferred_language === 'es'} onChange={() => setC('preferred_language', 'es')} /> Español</label>
              </div>
            </div>
          </div>

          <div className="reg-card">
            <div className="reg-title">🐾 Your Pets / Sus Mascotas</div>
            <div className="reg-tabs">
              {pets.map((_, i) => (
                <button key={i} type="button" className={i === active ? 'reg-tab active' : 'reg-tab'} onClick={() => setActive(i)}>
                  Pet {i + 1} / Mascota {i + 1}
                </button>
              ))}
              {pets.length < MAX_PETS && (
                <button type="button" className="reg-add" onClick={addPet}>+ Add pet / Agregar mascota</button>
              )}
            </div>

            <div className="reg-row">
              <Field en="Pet Name" es="Nombre" required={active === 0}>
                <input value={pet.name} placeholder={['Fido', 'Luna', 'Mochi'][active]} autoCapitalize="words" onChange={(e) => setP(active, 'name', titleCase(e.target.value))} />
              </Field>
              <Field en="Species" es="Especie" required={active === 0}>
                <select value={pet.species} onChange={(e) => setP(active, 'species', e.target.value)}>
                  <option value="">— Select / Seleccionar —</option>
                  <option value="dog">Dog / Perro</option>
                  <option value="cat">Cat / Gato</option>
                </select>
              </Field>
            </div>
            <div className="reg-row">
              <Field en="Breed" es="Raza">
                <input value={pet.breed} placeholder="Mixed / Mestizo" onChange={(e) => setP(active, 'breed', e.target.value)} />
              </Field>
              <Field en="Age" es="Edad">
                <div className="reg-age">
                  <input type="number" min="0" max="30" step="1" value={pet.age} placeholder="2" onChange={(e) => setP(active, 'age', e.target.value)} />
                  <select value={pet.age_unit} onChange={(e) => setP(active, 'age_unit', e.target.value)}>
                    <option value="years">Years / Años</option>
                    <option value="months">Months / Meses</option>
                  </select>
                </div>
              </Field>
            </div>
            <Field en="Weight (lbs)" es="Peso (libras)">
              <input type="number" min="0" step="0.1" value={pet.weight} placeholder="25" onChange={(e) => setP(active, 'weight', e.target.value)} />
            </Field>
            <div className="reg-row three">
              <Field en="Sex" es="Sexo">
                <select value={pet.sex} onChange={(e) => setP(active, 'sex', e.target.value)}>
                  <option value="unknown">Not sure / No sé</option>
                  <option value="male">Male / Macho</option>
                  <option value="female">Female / Hembra</option>
                </select>
              </Field>
              <Field en="Spayed / Neutered" es="Esterilizado/a">
                <select value={pet.altered} onChange={(e) => setP(active, 'altered', e.target.value)}>
                  <option value="unknown">Not sure / No sé</option>
                  <option value="yes">Yes / Sí</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field en="Microchipped?" es="¿Tiene microchip?">
                <select value={pet.microchipped} onChange={(e) => setP(active, 'microchipped', e.target.value)}>
                  <option value="unknown">Not sure / No sé</option>
                  <option value="yes">Yes / Sí</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
            <Field en="Colors / Markings" es="Colores / Marcas">
              <input value={pet.colors_markings} placeholder="e.g. Black & white, tabby / Negro y blanco, atigrado" onChange={(e) => setP(active, 'colors_markings', e.target.value)} />
            </Field>
          </div>

          <div className="reg-card">
            <div className="reg-title">📋 Waiver / Exención de Responsabilidad</div>
            <div className="reg-tabs">
              <button type="button" className={waiverLang === 'en' ? 'reg-tab active' : 'reg-tab'} onClick={() => setWaiverLang('en')}>English</button>
              <button type="button" className={waiverLang === 'es' ? 'reg-tab active' : 'reg-tab'} onClick={() => setWaiverLang('es')}>Español</button>
            </div>
            <div className="reg-waiver">
              {waiver.map((t, i) => <p key={i}>{t}</p>)}
            </div>
            <div className="lbl">Signature / <span className="es">Firma</span><span className="req">*</span></div>
            <div className={sigError ? 'reg-sig error' : signed ? 'reg-sig signed' : 'reg-sig'}>
              <canvas ref={canvasRef} />
            </div>
            <p className="reg-hint">Sign above with your finger or mouse. / Firme arriba con su dedo o ratón.</p>
            <button type="button" className="reg-clear" onClick={() => { padRef.current?.clear(); setSigned(false) }}>✕ Clear / Borrar</button>
          </div>

          <div className="reg-submit-area">
            <button type="submit" className="reg-submit" disabled={submitting}>
              {submitting ? 'Submitting… / Enviando…' : 'Submit Registration / Enviar Registro'}
            </button>
            <p className="reg-note">
              Your information is used only to coordinate your visit.<br />
              <em>Su información se usa solo para coordinar su visita.</em>
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}