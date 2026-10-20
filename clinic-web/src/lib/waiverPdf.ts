import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Client } from '../types'

const EN = [
  'I, the undersigned, am using the medical services provided by People Helping Pets ("Clinic"). I understand that the Clinic is community-based and may include volunteer veterinarians, veterinary technicians, assistants, students, managers, and helpers.',
  'I confirm that I am at least 18 years old and am legally authorized to make decisions for the animal(s) I am presenting today. I authorize the Clinic and its representatives to examine, vaccinate, microchip, and provide any other services I select or that are considered necessary.',
  'I understand that these services do not replace full veterinary care and that the Clinic is not a full-service veterinary hospital. I am responsible for seeking and paying for any additional care recommended for my pet. I will inform Clinic staff, to the best of my knowledge, of any preexisting medical conditions, and I understand that some conditions may prevent my pet from receiving services.',
  'I understand that vaccines and other services carry some risk. Mild side effects can include soreness, lethargy, or fever, while serious reactions are rare but possible and may require immediate veterinary attention.',
  'I release and hold harmless People Helping Pets, including its directors, officers, volunteers, veterinarians, staff, and representatives, from liability for any injury, harm, or damage to me, my pet, or my personal property related to services provided at the Clinic.',
  'I understand that photos or videos may be taken at Clinic events, and I give permission for People Helping Pets to use images of me, my pet, or others accompanying me for educational or promotional purposes. Anyone who does not wish to be photographed should let staff know at check-in.',
]

const ES = [
  'Yo, la persona abajo firmante, estoy utilizando los servicios médicos proporcionados por People Helping Pets ("la Clínica"). Entiendo que la Clínica es comunitaria y puede incluir veterinarios voluntarios, técnicos veterinarios, asistentes, estudiantes, administradores y ayudantes.',
  'Confirmo que tengo al menos 18 años de edad y que estoy legalmente autorizado(a) para tomar decisiones por el/los animal(es) que presento hoy. Autorizo a la Clínica y a sus representantes a examinar, vacunar, colocar microchip y proporcionar cualquier otro servicio que seleccione o que se considere necesario.',
  'Entiendo que estos servicios no reemplazan la atención veterinaria completa y que la Clínica no es un hospital veterinario de servicio completo. Soy responsable de buscar y pagar cualquier atención adicional recomendada para mi mascota. Informaré al personal de la Clínica, según mi conocimiento, sobre cualquier condición médica preexistente, y entiendo que algunas condiciones pueden impedir que mi mascota reciba ciertos servicios.',
  'Entiendo que las vacunas y otros servicios conllevan algunos riesgos. Los efectos secundarios leves pueden incluir dolor en el sitio de aplicación, letargo o fiebre, mientras que las reacciones graves son poco comunes pero posibles y pueden requerir atención veterinaria inmediata.',
  'Libero y eximo de responsabilidad a People Helping Pets, incluyendo a sus directores, oficiales, voluntarios, veterinarios, personal y representantes, por cualquier lesión, daño o perjuicio a mí, a mi mascota o a mi propiedad personal relacionado con los servicios proporcionados en la Clínica.',
  'Entiendo que se pueden tomar fotos o videos durante los eventos de la Clínica, y doy permiso a People Helping Pets para utilizar imágenes mías, de mi mascota o de cualquier persona que me acompañe con fines educativos o promocionales. Las personas que no deseen ser fotografiadas deben informar al personal al momento del registro.',
]

export interface WaiverVisit {
  event_date: string | null
  waiver_signature: string
  waiver_signed_at: string | null
}

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—'

export async function buildWaiverPdf(visit: WaiverVisit, client: Client): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const margin = 50
  const pageW = 612
  const pageH = 792
  const maxW = pageW - margin * 2
  const navy = rgb(0.1, 0.23, 0.56)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.35, 0.39, 0.5)

  let page: PDFPage = doc.addPage([pageW, pageH])
  let y = pageH - margin

  function wrap(text: string, size: number, width: number, f: PDFFont) {
    const lines: string[] = []
    let line = ''
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word
      if (f.widthOfTextAtSize(test, size) <= width) line = test
      else {
        if (line) lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines
  }

  function draw(text: string, size: number, color = black, f = font) {
    for (const line of wrap(text, size, maxW, f)) {
      if (y < margin + 80) {
        page = doc.addPage([pageW, pageH])
        y = pageH - margin
      }
      page.drawText(line, { x: margin, y, size, font: f, color })
      y -= size + 4
    }
  }
  const paragraph = (t: string) => { draw(t, 9.5); y -= 6 }
  const heading = (t: string) => { draw(t, 12, navy, bold); y -= 4 }
  const rule = () => {
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: rgb(0.78, 0.83, 0.93) })
    y -= 12
  }

  draw('People Helping Pets', 16, navy, bold)
  y -= 2
  draw('Liability Waiver & Consent Form / Exoneración de Responsabilidad', 10, gray)
  y -= 8
  rule()
  draw(`Client: ${client.name || '—'}`, 10, black, bold)
  y -= 2
  draw(`Clinic Date: ${fmtDate(visit.event_date)}`, 10)
  y -= 12
  rule()

  heading('Liability Waiver & Consent — English')
  y -= 4
  EN.forEach(paragraph)
  y -= 8
  rule()
  heading('Exoneración de Responsabilidad y Consentimiento — Español')
  y -= 4
  ES.forEach(paragraph)
  y -= 8
  rule()

  draw('Client Signature / Firma del Cliente', 10, gray)
  y -= 12

  const b64 = visit.waiver_signature.replace(/^data:image\/\w+;base64,/, '')
  const sigBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  let img
  try {
    img = await doc.embedPng(sigBytes)
  } catch {
    try {
      img = await doc.embedJpg(sigBytes)
    } catch {
      throw new Error('The saved signature image could not be read')
    }
  }
  const sigH = 60
  const sigW = Math.min(250, sigH * 4)
  if (y < margin + sigH + 40) {
    page = doc.addPage([pageW, pageH])
    y = pageH - margin
  }
  page.drawImage(img, { x: margin, y: y - sigH, width: sigW, height: sigH })
  y -= sigH + 8
  draw(`Signed: ${fmtDateTime(visit.waiver_signed_at)}`, 9, gray)
  y -= 4
  draw(`${client.name || ''}  |  ${client.phone || ''}  |  ${client.email || ''}`, 9, gray)

  return doc.save()
}