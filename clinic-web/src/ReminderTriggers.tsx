import { useEffect, useState } from 'react';
import { sbGet, sbPost, sbPatch } from './lib/api';

type Conditions = { has_intact_pet?: boolean; has_microchip?: boolean; zip?: string[] };
type Trigger = {
  id: string;
  name: string;
  description: string | null;
  event: string;
  active: boolean;
  conditions: Conditions | null;
  template_en: string;
  template_es: string;
};
type Tpl = { id: string; subject: string | null; body: string | null };

const EVENTS: Record<string, string> = {
  post_clinic: '💉 Post-Vaccine Clinic',
  post_booster: '🔁 Post-Booster Clinic',
  reminder_2w: '📅 2-Week Reminder',
  reminder_1w: '📅 1-Week Reminder',
};
const EVENT_OPTIONS: Record<string, string> = {
  post_clinic: 'Post-Vaccine Clinic',
  post_booster: 'Post-Booster Clinic',
  reminder_2w: '2-Week Vaccine Reminder',
  reminder_1w: '1-Week Vaccine Reminder',
};

type Form = {
  name: string;
  description: string;
  event: string;
  intact: boolean;
  chip: boolean;
  zipOn: boolean;
  zips: string;
  tplEn: string;
  tplEs: string;
  enSubject: string;
  enBody: string;
  esSubject: string;
  esBody: string;
};

const EMPTY: Form = {
  name: '', description: '', event: 'post_clinic',
  intact: false, chip: false, zipOn: false, zips: '',
  tplEn: '', tplEs: '', enSubject: '', enBody: '', esSubject: '', esBody: '',
};

const ID_RE = /^[a-z0-9_]+$/;
const enc = encodeURIComponent;

async function upsertTemplate(id: string, subject: string, body: string) {
  const now = new Date().toISOString();
  const out = await sbPatch<Tpl>(`email_templates?id=eq.${enc(id)}`, { subject, body, updated_at: now });
  if (out && out.length) return;
  try {
    await sbPost('email_templates', { id, subject, body, updated_at: now });
  } catch (e: any) {
    throw new Error(
      `Could not create template "${id}": ${e.message || e}. If this mentions row-level security, the database needs the optional policy migration (see the stage 3 notes).`
    );
  }
}

export default function ReminderTriggers() {
  const [rows, setRows] = useState<Trigger[] | null>(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<Trigger | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [modalMsg, setModalMsg] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setErr('');
    try {
      setRows(await sbGet<Trigger[]>('triggers?select=*&order=event.asc,created_at.asc,id.asc'));
    } catch (e: any) {
      setErr(e.message || 'Could not load triggers');
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(t: Trigger, active: boolean) {
    setErr('');
    setRows(prev => prev && prev.map(r => (r.id === t.id ? { ...r, active } : r)));
    try {
      const out = await sbPatch<Trigger>(`triggers?id=eq.${enc(t.id)}`, { active, updated_at: new Date().toISOString() });
      if (!out || out.length === 0) throw new Error('The update was blocked, so the trigger was not changed.');
    } catch (e: any) {
      setErr('Could not change trigger: ' + (e.message || e));
      setRows(prev => prev && prev.map(r => (r.id === t.id ? { ...r, active: t.active } : r)));
    }
  }

  function setF<K extends keyof Form>(k: K, v: Form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function loadTemplates(enId = form.tplEn.trim(), esId = form.tplEs.trim()) {
    if (!enId && !esId) {
      setModalMsg({ type: 'error', text: 'Enter template IDs first, then click Load.' });
      return;
    }
    try {
      const [en, es] = await Promise.all([
        enId ? sbGet<Tpl[]>(`email_templates?id=eq.${enc(enId)}&select=id,subject,body`) : Promise.resolve([] as Tpl[]),
        esId ? sbGet<Tpl[]>(`email_templates?id=eq.${enc(esId)}&select=id,subject,body`) : Promise.resolve([] as Tpl[]),
      ]);
      setForm(f => ({
        ...f,
        enSubject: enId ? en[0]?.subject || '' : f.enSubject,
        enBody: enId ? en[0]?.body || '' : f.enBody,
        esSubject: esId ? es[0]?.subject || '' : f.esSubject,
        esBody: esId ? es[0]?.body || '' : f.esBody,
      }));
      const missing = [enId && !en.length ? enId : '', esId && !es.length ? esId : ''].filter(Boolean);
      setModalMsg(
        missing.length
          ? { type: 'info', text: `No template found for: ${missing.join(', ')}. Fill in the content below and it will be created on save.` }
          : null
      );
    } catch (e: any) {
      setModalMsg({ type: 'error', text: 'Could not load templates: ' + (e.message || e) });
    }
  }

  function openModal(t: Trigger | null) {
    setEditing(t);
    setModalMsg(null);
    if (!t) {
      setForm(EMPTY);
    } else {
      const c = t.conditions || {};
      const zips = Array.isArray(c.zip) ? c.zip : [];
      setForm({
        ...EMPTY,
        name: t.name,
        description: t.description || '',
        event: t.event,
        intact: !!c.has_intact_pet,
        chip: !!c.has_microchip,
        zipOn: zips.length > 0,
        zips: zips.join(', '),
        tplEn: t.template_en,
        tplEs: t.template_es,
      });
      loadTemplates(t.template_en, t.template_es);
    }
    setOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    const enId = form.tplEn.trim();
    const esId = form.tplEs.trim();
    const fail = (text: string) => setModalMsg({ type: 'error', text });

    if (!name) return fail('Trigger name is required.');
    if (!enId) return fail('English template ID is required.');
    if (!esId) return fail('Spanish template ID is required.');
    if (!ID_RE.test(enId) || !ID_RE.test(esId))
      return fail('Template IDs may only use lowercase letters, numbers and underscores.');
    if (enId === esId) return fail('English and Spanish need different template IDs.');

    const conditions: Conditions = {};
    if (form.intact) conditions.has_intact_pet = true;
    if (form.chip) conditions.has_microchip = true;
    if (form.zipOn) {
      const zips = form.zips.split(',').map(z => z.trim()).filter(Boolean);
      const bad = zips.filter(z => !/^\d{5}$/.test(z));
      if (bad.length) return fail(`These don't look like 5-digit ZIP codes: ${bad.join(', ')}`);
      if (!zips.length) return fail('Enter at least one ZIP code, or uncheck the ZIP condition.');
      conditions.zip = zips;
    }

    const isNew = !editing;
    const newId = isNew ? name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : editing!.id;
    if (!newId) return fail('Trigger name needs at least one letter or number.');

    setSaving(true);
    setModalMsg(null);
    try {
      if (isNew) {
        const dup = await sbGet<{ id: string }[]>(`triggers?id=eq.${enc(newId)}&select=id`);
        if (dup.length) throw new Error(`A trigger with the ID "${newId}" already exists. Pick a different name.`);
      }

      // Templates: write the ones with content; for the others, make sure a row already exists.
      const sides = [
        { id: enId, subject: form.enSubject.trim(), body: form.enBody.trim() },
        { id: esId, subject: form.esSubject.trim(), body: form.esBody.trim() },
      ];
      for (const s of sides) {
        if (s.subject || s.body) continue;
        const ex = await sbGet<{ id: string }[]>(`email_templates?id=eq.${enc(s.id)}&select=id`);
        if (!ex.length) throw new Error(`Template "${s.id}" doesn't exist yet. Add its email content, or use an existing template ID.`);
      }
      for (const s of sides) {
        if (s.subject || s.body) await upsertTemplate(s.id, s.subject, s.body);
      }

      const fields = {
        name,
        description: form.description.trim() || null,
        event: form.event,
        conditions,
        template_en: enId,
        template_es: esId,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        await sbPost('triggers', { id: newId, ...fields, active: true });
      } else {
        // Editing never changes the on/off switch.
        const out = await sbPatch<Trigger>(`triggers?id=eq.${enc(newId)}`, fields);
        if (!out || out.length === 0) throw new Error('The update was blocked, so the trigger was not saved.');
      }

      setOpen(false);
      await load();
    } catch (e: any) {
      fail(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rm-card">
      <div className="rm-card-head">
        <span>⚡ Email Triggers</span>
        <button className="rm-btn rm-btn-green" onClick={() => openModal(null)}>+ New Trigger</button>
      </div>
      {err && <div className="rm-msg error">{err}</div>}
      <div className="rm-table-wrap">
        <table className="rm-table">
          <thead>
            <tr><th>Name</th><th>Event</th><th>Conditions</th><th>Templates</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={6} className="rm-empty">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="rm-empty">No triggers yet. Click + New Trigger to create one.</td></tr>
            ) : (
              rows.map(t => {
                const c = t.conditions || {};
                const conds: string[] = [];
                if (c.has_intact_pet) conds.push('Has intact pet');
                if (c.has_microchip) conds.push('Has microchip');
                if (c.zip?.length) conds.push(`ZIP: ${c.zip.join(', ')}`);
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{t.name}</div>
                      {t.description && <div className="rm-small">{t.description}</div>}
                    </td>
                    <td className="rm-small">{EVENTS[t.event] || t.event}</td>
                    <td className="rm-small">
                      {conds.length ? conds.map(x => <div key={x}>{x}</div>) : <span>Everyone</span>}
                    </td>
                    <td className="rm-small rm-mono">{t.template_en}<br />{t.template_es}</td>
                    <td>
                      <label className="rm-toggle">
                        <input type="checkbox" checked={t.active} onChange={e => toggle(t, e.target.checked)} />
                        <span>{t.active ? 'On' : 'Off'}</span>
                      </label>
                    </td>
                    <td><button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => openModal(t)}>✏️ Edit</button></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="rm-modal-bg">
          <div className="rm-modal rm-modal-form">
            <div className="rm-modal-head">
              <div className="rm-modal-title">{editing ? 'Edit Trigger' : 'New Trigger'}</div>
              <button className="rm-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="rm-modal-scroll">
              {modalMsg && <div className={'rm-msg-inline ' + modalMsg.type}>{modalMsg.text}</div>}

              <div className="rm-two">
                <div className="rm-field">
                  <label>Trigger Name *</label>
                  <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Tree House S/N Program" />
                </div>
                <div className="rm-field">
                  <label>Send After *</label>
                  <select value={form.event} onChange={e => setF('event', e.target.value)}>
                    {Object.entries(EVENT_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="rm-field" style={{ marginTop: '.75rem' }}>
                <label>Description</label>
                <input value={form.description} onChange={e => setF('description', e.target.value)} placeholder="What does this trigger do?" />
              </div>

              <div className="rm-conds">
                <div className="rm-conds-title">Conditions — only send if…</div>
                <label className="rm-check">
                  <input type="checkbox" checked={form.intact} onChange={e => setF('intact', e.target.checked)} />
                  <span>Client has at least one pet that is <strong>not confirmed spayed/neutered</strong></span>
                </label>
                <label className="rm-check">
                  <input type="checkbox" checked={form.chip} onChange={e => setF('chip', e.target.checked)} />
                  <span>Client has at least one pet with a <strong>microchip on record</strong></span>
                </label>
                <label className="rm-check">
                  <input type="checkbox" checked={form.zipOn} onChange={e => setF('zipOn', e.target.checked)} />
                  <span>Client lives in specific <strong>ZIP codes</strong></span>
                </label>
                {form.zipOn && (
                  <div className="rm-field" style={{ marginLeft: '1.5rem' }}>
                    <input value={form.zips} onChange={e => setF('zips', e.target.value)} placeholder="60651, 60639" />
                    <div className="rm-small">Comma-separated 5-digit ZIP codes</div>
                  </div>
                )}
                <div className="rm-small" style={{ marginTop: '.6rem' }}>
                  All checked conditions must be true. Leave all unchecked to send to everyone.
                </div>
              </div>

              <div className="rm-two">
                <div className="rm-field">
                  <label>English Template ID *</label>
                  <input className="rm-mono" value={form.tplEn} onChange={e => setF('tplEn', e.target.value)} placeholder="e.g. tree_house_snip_en" />
                </div>
                <div className="rm-field">
                  <label>Spanish Template ID *</label>
                  <input className="rm-mono" value={form.tplEs} onChange={e => setF('tplEs', e.target.value)} placeholder="e.g. tree_house_snip_es" />
                </div>
              </div>

              <div className="rm-editor">
                <div className="rm-editor-head">
                  <span>✏️ Email Content</span>
                  <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => loadTemplates()}>Load / Refresh</button>
                </div>
                <div className="rm-two rm-pad">
                  <div className="rm-field">
                    <label>🇺🇸 English — section heading</label>
                    <input value={form.enSubject} onChange={e => setF('enSubject', e.target.value)} />
                    <label>Body</label>
                    <textarea rows={6} value={form.enBody} onChange={e => setF('enBody', e.target.value)} />
                  </div>
                  <div className="rm-field">
                    <label>🇲🇽 Español — encabezado de sección</label>
                    <input value={form.esSubject} onChange={e => setF('esSubject', e.target.value)} />
                    <label>Cuerpo</label>
                    <textarea rows={6} value={form.esBody} onChange={e => setF('esBody', e.target.value)} />
                  </div>
                </div>
                <div className="rm-small" style={{ padding: '0 1rem .75rem' }}>
                  Variables: <code>{'{{owner_name}}'}</code> <code>{'{{clinic_date}}'}</code> <code>{'{{snip_link}}'}</code> <code>{'{{chip_links}}'}</code> <code>{'{{website_link}}'}</code>
                </div>
              </div>
            </div>
            <div className="rm-modal-foot">
              <button className="rm-btn rm-btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button className="rm-btn rm-btn-green" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Trigger'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}