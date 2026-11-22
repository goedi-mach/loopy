// Liability waiver shown on the registration page and printed in the waiver PDF.
// One copy of the text, so the two can't drift apart. `org` is the organization's
// name from Settings.
// Note: the PDF is generated later from this same text, so a waiver signed in the past
// prints with the current wording and name.

export function waiverText(lang: 'en' | 'es', org: string): string[] {
  if (lang === 'es') {
    return [
      `Yo, la persona abajo firmante, estoy utilizando los servicios médicos proporcionados por ${org} ("la Clínica"). Entiendo que la Clínica es comunitaria y puede incluir veterinarios voluntarios, técnicos veterinarios, asistentes, estudiantes, administradores y ayudantes.`,
      `Confirmo que tengo al menos 18 años de edad y que estoy legalmente autorizado(a) para tomar decisiones por el/los animal(es) que presento hoy. Autorizo a la Clínica y a sus representantes a examinar, vacunar, colocar microchip y proporcionar cualquier otro servicio que seleccione o que se considere necesario.`,
      `Entiendo que estos servicios no reemplazan la atención veterinaria completa y que la Clínica no es un hospital veterinario de servicio completo. Soy responsable de buscar y pagar cualquier atención adicional recomendada para mi mascota. Informaré al personal de la Clínica, según mi conocimiento, sobre cualquier condición médica preexistente, y entiendo que algunas condiciones pueden impedir que mi mascota reciba ciertos servicios.`,
      `Entiendo que las vacunas y otros servicios conllevan algunos riesgos. Los efectos secundarios leves pueden incluir dolor en el sitio de aplicación, letargo o fiebre, mientras que las reacciones graves son poco comunes pero posibles y pueden requerir atención veterinaria inmediata.`,
      `Libero y eximo de responsabilidad a ${org}, incluyendo a sus directores, oficiales, voluntarios, veterinarios, personal y representantes, por cualquier lesión, daño o perjuicio a mí, a mi mascota o a mi propiedad personal relacionado con los servicios proporcionados en la Clínica.`,
      `Entiendo que se pueden tomar fotos o videos durante los eventos de la Clínica, y doy permiso a ${org} para utilizar imágenes mías, de mi mascota o de cualquier persona que me acompañe con fines educativos o promocionales. Las personas que no deseen ser fotografiadas deben informar al personal al momento del registro.`,
      `Acepto recibir recordatorios por correo electrónico de ${org} sobre las vacunas próximas de mi(s) mascota(s). Estos recordatorios se envían como cortesía y no reemplazan mi responsabilidad de buscar atención veterinaria oportuna.`,
    ]
  }
  return [
    `I, the undersigned, am using the medical services provided by ${org} ("Clinic"). I understand that the Clinic is community-based and may include volunteer veterinarians, veterinary technicians, assistants, students, managers, and helpers.`,
    `I confirm that I am at least 18 years old and am legally authorized to make decisions for the animal(s) I am presenting today. I authorize the Clinic and its representatives to examine, vaccinate, microchip, and provide any other services I select or that are considered necessary.`,
    `I understand that these services do not replace full veterinary care and that the Clinic is not a full-service veterinary hospital. I am responsible for seeking and paying for any additional care recommended for my pet. I will inform Clinic staff, to the best of my knowledge, of any preexisting medical conditions, and I understand that some conditions may prevent my pet from receiving services.`,
    `I understand that vaccines and other services carry some risk. Mild side effects can include soreness, lethargy, or fever, while serious reactions are rare but possible and may require immediate veterinary attention.`,
    `I release and hold harmless ${org}, including its directors, officers, volunteers, veterinarians, staff, and representatives, from liability for any injury, harm, or damage to me, my pet, or my personal property related to services provided at the Clinic.`,
    `I understand that photos or videos may be taken at Clinic events, and I give permission for ${org} to use images of me, my pet, or others accompanying me for educational or promotional purposes. Anyone who does not wish to be photographed should let staff know at check-in.`,
    `I agree to receive email reminders from ${org} regarding upcoming vaccinations for my pet(s). These reminders are sent as a courtesy and do not replace my responsibility to seek timely veterinary care.`,
  ]
}
