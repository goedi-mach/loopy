import { PDFDocument, PDFName, PDFString } from 'pdf-lib'
import type { Client, Pet, Vaccination } from '../types'

const TEMPLATES = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/templates`
const LICENSE = import.meta.env.VITE_VET_LICENSE_VALBUENA

export interface CertResult {
  bytes: Uint8Array
  problems: string[] // anything that could not be filled in; show these to staff
}

// MM/DD/YYYY straight from the stored date (no time zones involved)
function fmtDate(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

export async function buildRabiesCert(r: Vaccination, pet: Pet, client: Client): Promise<CertResult> {
  const problems: string[] = []

  const tpl = await fetch(`${TEMPLATES}/RabiesVacCert.pdf`)
  if (!tpl.ok) throw new Error('Could not load the certificate template')
  const pdfDoc = await PDFDocument.load(await tpl.arrayBuffer())
  const form = pdfDoc.getForm()
  const page = pdfDoc.getPages()[0]

  if (import.meta.env.DEV) {
    console.info('Certificate fields:', form.getFields().map((f) => f.getName()))
  }

  function setText(name: string, value: string | null | undefined, size = 10) {
    if (!value) return
    try {
      const field = form.getTextField(name)
      const v = PDFString.of(String(value))
      field.acroField.dict.set(PDFName.of('V'), v)
      field.acroField.dict.set(PDFName.of('DA'), PDFString.of(`0 0 0 rg /Helv ${size} Tf`))
      for (const w of field.acroField.getWidgets()) w.dict.set(PDFName.of('V'), v)
    } catch {
      problems.push(`Text box "${name}" was not found in the template`)
    }
  }

  // These radio groups have duplicate option values, so set each widget directly
  function setRadio(name: string, index: number | undefined) {
    if (index == null) return
    try {
      const field = form.getRadioGroup(name)
      const widgets = field.acroField.getWidgets()
      const on = PDFName.of(String(index))
      widgets.forEach((w, i) => w.dict.set(PDFName.of('AS'), i === index ? on : PDFName.of('Off')))
      field.acroField.dict.set(PDFName.of('V'), on)
    } catch {
      problems.push(`Option group "${name}" was not found in the template`)
    }
  }

  function setCheck(name: string, checked: boolean) {
    try {
      const box = form.getCheckBox(name)
      if (checked) box.check()
      else box.uncheck()
    } catch {
      problems.push(`Checkbox "${name}" was not found in the template`)
    }
  }

  // Owner
  const parts = (client.name || '').trim().split(' ')
  setText('First Name', parts[0])
  setText('Last Name', parts.slice(1).join(' '))
  setText('Telephone #', client.phone, 9)

  if (client.street || client.city || client.state || client.zip) {
    setText('Street', client.street)
    setText('City', client.city)
    setText('State', client.state)
    setText('Zip Code', client.zip)
  } else if (client.address) {
    // Older records kept one address string
    const m = client.address.trim().match(/^(.*?),\s*(.*?),\s*([A-Z]{2})\s+(\d[\d-]*)$/)
    if (m) {
      setText('Street', m[1])
      setText('City', m[2])
      setText('State', m[3])
      setText('Zip Code', m[4])
    } else {
      setText('Street', client.address)
    }
  }

  // Pet
  setText('Animal Name', pet.name)
  setText('Microchip #', pet.microchip_number, 8)
  setText('Predominent Breed', pet.breed, 9)
  setText('Predominemt Colors/Markings', r.colors_markings || pet.colors_markings, 8)

  if (pet.age != null && !isNaN(Number(pet.age))) {
    setText('Age', String(pet.age), 9)
    setRadio('Months/Years', pet.age_unit === 'months' ? 0 : 1)
  }
  if (pet.weight != null && !isNaN(Number(pet.weight))) {
    const w = Number(pet.weight)
    setRadio('Size', w < 20 ? 0 : w <= 50 ? 1 : 2)
  }
  setRadio('Species', { dog: 0, cat: 1, ferret: 2 }[(pet.species || '').toLowerCase()])
  if (pet.sex === 'male') setRadio('Sex', 0)
  if (pet.sex === 'female') setRadio('Sex', 1)
  setCheck('Neutered', pet.altered === 'yes')

  // Vaccine
  setText('Rabies Tag #', r.rabies_tag_number, 9)
  setText('Product Name', r.product_name, 9)
  setText('Vaccine Serial Number', r.lot_number, 9)

  if (LICENSE) setText('License Number', LICENSE, 9)
  else problems.push('Veterinarian license number is not configured (VITE_VET_LICENSE_VALBUENA)')

  const man = (r.manufacturer || '').toUpperCase().padEnd(3, ' ')
  setText('Manufacturer', man[0])
  setText('Man2', man[1])
  setText('Man3', man[2])

  setRadio('USDA Licensed Vaccine', { '1yr': 0, '3yr': 1, '4yr': 2 }[r.usda_duration || ''])
  if (r.dose_type === 'initial') setRadio('Dose', 0)
  if (r.dose_type === 'booster') setRadio('Dose', 1)

  if (r.usda_duration === '1yr') setCheck('AC 1 year', true)
  if (r.usda_duration === '3yr') setCheck('AC 3 year', true)

  setText('Date Vaccinated', fmtDate(r.date_given), 9)
  setText('Next Vaccination Date', fmtDate(r.next_due), 9)

  // Veterinarian
  setText("Veterinarian's Name", 'Dr. Ana Valbuena', 9)
  setText("Veterinarian's address", 'People Helping Pets, Chicago IL', 8)

  try {
    const sig = await fetch(`${TEMPLATES}/ana_signature.png`)
    if (!sig.ok) throw new Error('missing')
    const type = sig.headers.get('content-type') || ''
    const bytes = await sig.arrayBuffer()
    const img = type.includes('jpeg') || type.includes('jpg') ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes)
    page.drawImage(img, { x: 370, y: 452, width: 175, height: 28 })
  } catch {
    problems.push('The veterinarian signature image could not be added')
  }

  form.flatten()
  return { bytes: await pdfDoc.save(), problems }
}

export function certFilename(pet: Pet, r: Vaccination) {
  return `RabiesCert_${pet.name}_${r.date_given}.pdf`.replace(/[^\w.\-]+/g, '_')
}

export function saveCertFile(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Chunked, so large PDFs can't overflow the call stack
export function toBase64(bytes: Uint8Array) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}