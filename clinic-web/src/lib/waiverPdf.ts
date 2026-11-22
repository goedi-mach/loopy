import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Client } from '../types'
import { currentSettings } from './settings'
import { waiverText } from './waiver'

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

  const org = currentSettings().org_name
  draw(org, 16, navy, bold)
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
  waiverText('en', org).forEach(paragraph)
  y -= 8
  rule()
  heading('Exoneración de Responsabilidad y Consentimiento — Español')
  y -= 4
  waiverText('es', org).forEach(paragraph)
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