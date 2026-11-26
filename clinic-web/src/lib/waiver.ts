// Liability waiver wording.
// • Each organization edits its own wording on the Settings page (org_settings.waiver_en /
//   waiver_es): paragraphs separated by a blank line, with {{org_name}} standing for the
//   organization's name. The defaults below are the wording the app has always used.
// • Every signature saves the exact wording it was signed under (clients.waiver_text), and
//   the waiver PDF prints that saved wording, so editing the text never changes past waivers.

export interface WaiverSnapshot {
  org?: string // the organization's name when it was signed (older records don't have it)
  en: string
  es: string
}

interface WaiverSource {
  org_name: string
  waiver_en: string
  waiver_es: string
}

export const DEFAULT_WAIVER_EN = [
  "I, the undersigned, am using the medical services provided by {{org_name}} (\"Clinic\"). I understand that the Clinic is community-based and may include volunteer veterinarians, veterinary technicians, assistants, students, managers, and helpers.",
  "I confirm that I am at least 18 years old and am legally authorized to make decisions for the animal(s) I am presenting today. I authorize the Clinic and its representatives to examine, vaccinate, microchip, and provide any other services I select or that are considered necessary.",
  "I understand that these services do not replace full veterinary care and that the Clinic is not a full-service veterinary hospital. I am responsible for seeking and paying for any additional care recommended for my pet. I will inform Clinic staff, to the best of my knowledge, of any preexisting medical conditions, and I understand that some conditions may prevent my pet from receiving services.",
  "I understand that vaccines and other services carry some risk. Mild side effects can include soreness, lethargy, or fever, while serious reactions are rare but possible and may require immediate veterinary attention.",
  "I release and hold harmless {{org_name}}, including its directors, officers, volunteers, veterinarians, staff, and representatives, from liability for any injury, harm, or damage to me, my pet, or my personal property related to services provided at the Clinic.",
  "I understand that photos or videos may be taken at Clinic events, and I give permission for {{org_name}} to use images of me, my pet, or others accompanying me for educational or promotional purposes. Anyone who does not wish to be photographed should let staff know at check-in.",
  "I agree to receive email reminders from {{org_name}} regarding upcoming vaccinations for my pet(s). These reminders are sent as a courtesy and do not replace my responsibility to seek timely veterinary care.",
].join('\n\n')

export const DEFAULT_WAIVER_ES = [
  "Yo, la persona abajo firmante, estoy utilizando los servicios médicos proporcionados por {{org_name}} (\"la Clínica\"). Entiendo que la Clínica es comunitaria y puede incluir veterinarios voluntarios, técnicos veterinarios, asistentes, estudiantes, administradores y ayudantes.",
  "Confirmo que tengo al menos 18 años de edad y que estoy legalmente autorizado(a) para tomar decisiones por el/los animal(es) que presento hoy. Autorizo a la Clínica y a sus representantes a examinar, vacunar, colocar microchip y proporcionar cualquier otro servicio que seleccione o que se considere necesario.",
  "Entiendo que estos servicios no reemplazan la atención veterinaria completa y que la Clínica no es un hospital veterinario de servicio completo. Soy responsable de buscar y pagar cualquier atención adicional recomendada para mi mascota. Informaré al personal de la Clínica, según mi conocimiento, sobre cualquier condición médica preexistente, y entiendo que algunas condiciones pueden impedir que mi mascota reciba ciertos servicios.",
  "Entiendo que las vacunas y otros servicios conllevan algunos riesgos. Los efectos secundarios leves pueden incluir dolor en el sitio de aplicación, letargo o fiebre, mientras que las reacciones graves son poco comunes pero posibles y pueden requerir atención veterinaria inmediata.",
  "Libero y eximo de responsabilidad a {{org_name}}, incluyendo a sus directores, oficiales, voluntarios, veterinarios, personal y representantes, por cualquier lesión, daño o perjuicio a mí, a mi mascota o a mi propiedad personal relacionado con los servicios proporcionados en la Clínica.",
  "Entiendo que se pueden tomar fotos o videos durante los eventos de la Clínica, y doy permiso a {{org_name}} para utilizar imágenes mías, de mi mascota o de cualquier persona que me acompañe con fines educativos o promocionales. Las personas que no deseen ser fotografiadas deben informar al personal al momento del registro.",
  "Acepto recibir recordatorios por correo electrónico de {{org_name}} sobre las vacunas próximas de mi(s) mascota(s). Estos recordatorios se envían como cortesía y no reemplazan mi responsabilidad de buscar atención veterinaria oportuna.",
].join('\n\n')

export const fillOrgName = (text: string, org: string) => text.split('{{org_name}}').join(org)

// Text with blank lines between paragraphs -> the paragraphs
export const toParagraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

const wording = (s: WaiverSource, lang: 'en' | 'es') =>
  (lang === 'es' ? s.waiver_es : s.waiver_en)?.trim() || (lang === 'es' ? DEFAULT_WAIVER_ES : DEFAULT_WAIVER_EN)

// The current wording as paragraphs, with the name filled in (registration page)
export function waiverText(lang: 'en' | 'es', s: WaiverSource): string[] {
  return toParagraphs(fillOrgName(wording(s, lang), s.org_name))
}

// What to save next to a new signature
export function waiverSnapshot(s: WaiverSource): WaiverSnapshot {
  return {
    org: s.org_name,
    en: fillOrgName(wording(s, 'en'), s.org_name),
    es: fillOrgName(wording(s, 'es'), s.org_name),
  }
}
