// Volunteer quick-start shown by the "?" help button on the Clinic page.
// Wrap button names in **double asterisks** to render them in bold.

export type GuideLang = 'en' | 'es'

export type GuideSection = {
  heading: string
  intro?: string
  steps?: string[]
  table?: { head: [string, string]; rows: [string, string][] }
  note?: string
}

export type Guide = {
  title: string
  switchLabel: string
  close: string
  sections: GuideSection[]
}

export const CLINIC_GUIDE: Record<GuideLang, Guide> = {
  en: {
    title: 'Clinic day quick-start',
    switchLabel: 'Language',
    close: 'Close help',
    sections: [
      {
        heading: 'The clinic day at a glance',
        intro: 'Every client follows the same path. Intake and discharge both use this page.',
        steps: [
          '**Register.** Clients scan the QR code and fill in the form. Returning clients can register again or just tell a volunteer.',
          '**Intake.** Find the client here and confirm their information with them.',
          '**Vaccines.** The client is called up to vaccinate their pet.',
          '**Discharge.** Take the vets’ paperwork and log each vaccine (and microchip) here.',
          '**Go home.** Print the pet’s record and hand over the rabies tag, if the pet got one.',
        ],
        note: 'A client changes from Registered to Discharged on its own when a vaccine is logged.',
      },
      {
        heading: 'Intake: find the client and check their info',
        steps: [
          'Use **All**, **Registered** and **Discharged** to narrow the list, or type a name, email or phone number and press **Search**.',
          'Select the client. Their details and pets open on the right.',
          'Read the name, phone, email and address back to the client. Fix anything wrong with **Edit**, then **Save**.',
          'Check each pet the same way with the pencil button.',
          'Notes for the next volunteer go in the notes button, then **Save notes**.',
        ],
        note: 'Not on the list? Search again by phone or email. Still nothing: press **+ Walk-in**, fill in the name (required), contact details, address and the first pet, and have the client sign the waiver. Press **Save & Check In**. If you see “Possible duplicate” and it is the same person, press **Use this client**. Extra pets go in with **Add a pet**.',
      },
      {
        heading: 'Discharge: log vaccines and print the record',
        steps: [
          'Select the client, then the pet.',
          'Under **Log a Vaccine**, fill in the vaccine, lot, duration and date given. Check **Administered By**, then press **Log Vaccine**. Repeat for each vaccine.',
          'Rabies: enter the **Rabies Tag #**, colors and markings, and confirm the dose type.',
          'Microchip implanted today? Open **Log Microchip**, type the number (digits only) and press **Save Microchip**.',
          'Use **Download Rabies Certificate**, or **Email to Client** if the client has an email on file.',
          'Print the pet’s record in **English** or **Español** and hand over the rabies tag.',
        ],
        note: 'If a lot is missing or the manufacturer is blank, tell an admin before logging. If an error appears after **Log Vaccine**, nothing was saved: fix the field it names and try again.',
      },
      {
        heading: 'When things change',
        table: {
          head: ['Situation', 'What to do'],
          rows: [
            ['A pet is added', 'Select the client, press **Add a pet**, fill in the details and save.'],
            ['A pet is removed', 'Press the archive button on the pet and choose a reason. Its history is kept.'],
            ['A walk-in arrives', 'Press **+ Walk-in** and register them.'],
            ['A client cannot be found', 'Search by phone and email, then register them as a walk-in.'],
            ['A client should be removed', 'Open the ⋯ menu on the client and choose **Archive**.'],
            ['Saved by mistake', 'Ask an admin. Only admins can permanently delete.'],
          ],
        },
        note: 'Anything else, or a message you do not understand: ask an admin on duty and tell them what the screen says.',
      },
    ],
  },
  es: {
    title: 'Guía rápida del día de clínica',
    switchLabel: 'Idioma',
    close: 'Cerrar ayuda',
    sections: [
      {
        heading: 'El día de la clínica',
        intro: 'Todos los clientes siguen el mismo camino. Recepción y salida usan esta misma página.',
        steps: [
          '**Registro.** Los clientes escanean el código QR y llenan el formulario. Quienes ya vinieron pueden registrarse de nuevo o avisar a un voluntario.',
          '**Recepción (intake).** Encuentre al cliente aquí y confirme sus datos con él o ella.',
          '**Vacunas.** Se llama al cliente para vacunar a su mascota.',
          '**Salida (discharge).** Tome los papeles de los veterinarios y registre cada vacuna (y microchip) aquí.',
          '**A casa.** Imprima el registro de la mascota y entregue la placa de rabia, si la recibió.',
        ],
        note: 'El cliente pasa solo de Registered a Discharged cuando se registra una vacuna.',
      },
      {
        heading: 'Recepción: encontrar al cliente y revisar sus datos',
        steps: [
          'Use **All**, **Registered** y **Discharged** para filtrar la lista, o escriba un nombre, correo o teléfono y presione **Search**.',
          'Seleccione al cliente. Sus datos y mascotas aparecen a la derecha.',
          'Lea al cliente su nombre, teléfono, correo y dirección. Corrija lo que esté mal con **Edit** y luego **Save**.',
          'Revise cada mascota igual, con el botón del lápiz.',
          'Las notas para el siguiente voluntario van en el botón de notas, luego **Save notes**.',
        ],
        note: '¿No aparece en la lista? Busque otra vez por teléfono o correo. Si sigue sin aparecer, presione **+ Walk-in**, llene el nombre (obligatorio), los datos de contacto, la dirección y la primera mascota, y pida al cliente que firme la exención (waiver). Presione **Save & Check In**. Si sale “Possible duplicate” y es la misma persona, presione **Use this client**. Las demás mascotas se agregan con **Add a pet**.',
      },
      {
        heading: 'Salida: registrar vacunas e imprimir el registro',
        steps: [
          'Seleccione al cliente y luego a la mascota.',
          'En **Log a Vaccine**, llene la vacuna, el lote, la duración y la fecha. Revise **Administered By** y presione **Log Vaccine**. Repita por cada vacuna.',
          'Rabia: escriba el número en **Rabies Tag #**, los colores y marcas, y confirme el tipo de dosis.',
          '¿Se puso un microchip hoy? Abra **Log Microchip**, escriba el número (solo dígitos) y presione **Save Microchip**.',
          'Use **Download Rabies Certificate**, o **Email to Client** si el cliente tiene correo registrado.',
          'Imprima el registro de la mascota en **English** o **Español** y entregue la placa de rabia.',
        ],
        note: 'Si falta un lote o el fabricante está en blanco, avise a un administrador antes de registrar. Si aparece un error después de **Log Vaccine**, no se guardó nada: corrija el campo que indica y vuelva a intentar.',
      },
      {
        heading: 'Cuando algo cambia',
        table: {
          head: ['Situación', 'Qué hacer'],
          rows: [
            ['Se agrega una mascota', 'Seleccione al cliente, presione **Add a pet**, llene los datos y guarde.'],
            ['Se quita una mascota', 'Presione el botón de archivar en la mascota y elija el motivo. Su historial se conserva.'],
            ['Llega un cliente sin registro', 'Presione **+ Walk-in** y regístrelo.'],
            ['No se encuentra al cliente', 'Busque por teléfono y correo; si no aparece, regístrelo como walk-in.'],
            ['Hay que quitar a un cliente', 'En el menú ⋯ del cliente elija **Archive**.'],
            ['Se guardó algo por error', 'Pregunte a un administrador. Solo ellos pueden borrar de forma permanente.'],
          ],
        },
        note: 'Para cualquier otra duda, o un mensaje que no entienda, hable con un administrador de turno y dígale lo que dice la pantalla.',
      },
    ],
  },
}
