import { useEffect, useState } from 'react';
import { sbGet, sbPatch } from './lib/api';

type Row = { id: string; subject: string; body: string };

// One editable block = one row in email_templates.
type Block = { id: string; title: string; subjectLabel: string; noBody?: boolean };

type Template = {
  key: string;
  label: string;
  heading: string;
  hint: string;
  blocks: Block[];
  requireAll: boolean; // reminders must have subject+body; memos may leave body empty
};

const REMINDER_HINT =
  '{{owner_name}} {{pet_name}} {{vaccine}} {{due_date}} — booster templates only: {{clinic_date_line}} (the clinic date sentence, or a "stay tuned" fallback).';

function reminderBlocks(p: string): Block[] {
  return [
    { id: `${p}_en`, title: '🇺🇸 English — Standard', subjectLabel: 'Subject' },
    { id: `${p}_en_booster`, title: '🇺🇸 English — Booster', subjectLabel: 'Subject' },
    { id: `${p}_es`, title: '🇲🇽 Spanish — Standard', subjectLabel: 'Subject' },
    { id: `${p}_es_booster`, title: '🇲🇽 Spanish — Booster', subjectLabel: 'Subject' },
  ];
}

function memoBlocks(p: string): Block[] {
  return [
    { id: `${p}_subject`, title: 'Subject line (shared)', subjectLabel: 'Subject', noBody: true },
    { id: `${p}_en`, title: '🇺🇸 English — Main Body', subjectLabel: 'Greeting' },
    { id: `${p}_es`, title: '🇲🇽 Spanish — Main Body', subjectLabel: 'Greeting' },
    { id: `${p}_chip_en`, title: '🇺🇸 English — Chip Registration (only if chip on file)', subjectLabel: 'Heading' },
    { id: `${p}_chip_es`, title: '🇲🇽 Spanish — Chip Registration (solo si tiene chip)', subjectLabel: 'Heading' },
    { id: `${p}_snip_en`, title: '🇺🇸 English — Spay/Neuter (only if snip_interest)', subjectLabel: 'Heading' },
    { id: `${p}_snip_es`, title: '🇲🇽 Spanish — Spay/Neuter (solo si snip_interest)', subjectLabel: 'Heading' },
  ];
}

const TEMPLATES: Template[] = [
  {
    key: 'reminder_2w',
    label: '2-Week Reminder',
    heading: '2-Week Reminder',
    hint: REMINDER_HINT,
    blocks: reminderBlocks('reminder_2w'),
    requireAll: true,
  },
  {
    key: 'reminder_1w',
    label: '1-Week Reminder',
    heading: '1-Week Reminder',
    hint: REMINDER_HINT,
    blocks: reminderBlocks('reminder_1w'),
    requireAll: true,
  },
  {
    key: 'postclinic_vaccine',
    label: '💉 Post-Vaccine Memo',
    heading: '💉 Post-Vaccine Clinic Memo',
    hint:
      '{{owner_name}} {{clinic_date}} {{clinic_date_es}} {{reaction_doc_en}} {{reaction_doc_es}} {{pet_due_dates_en}} {{pet_due_dates_es}} {{next_booster_clinic}} {{snip_link}}',
    blocks: memoBlocks('postclinic_vaccine'),
    requireAll: false,
  },
  {
    key: 'postclinic_booster',
    label: '🔁 Post-Booster Memo',
    heading: '🔁 Post-Booster Clinic Memo',
    hint:
      '{{owner_name}} {{clinic_date}} {{clinic_date_es}} {{reaction_doc_en}} {{reaction_doc_es}} {{pet_due_dates_en}} {{pet_due_dates_es}} {{website_link}} {{snip_link}}',
    blocks: memoBlocks('postclinic_booster'),
    requireAll: false,
  },
];

type Msg = { type: 'success' | 'error'; text: string } | null;

export default function ReminderTemplates() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const [active, setActive] = useState(TEMPLATES[0].key);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Record<string, Msg>>({});

  useEffect(() => {
    (async () => {
      try {
        const data = await sbGet<Row[]>('email_templates?select=id,subject,body');
        const map: Record<string, Row> = {};
        data.forEach(r => (map[r.id] = r));
        setRows(map);
        setEdits(JSON.parse(JSON.stringify(map)));
      } catch (e: any) {
        setLoadErr(e.message || 'Could not load templates');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tpl = TEMPLATES.find(t => t.key === active)!;

  function setField(id: string, field: 'subject' | 'body', value: string) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], id, [field]: value } as Row }));
    setMsg(m => ({ ...m, [tpl.key]: null }));
  }

  async function save() {
    setSaving(true);
    setMsg(m => ({ ...m, [tpl.key]: null }));
    const missing: string[] = [];
    const empty: string[] = [];
    const toSave: Row[] = [];

    for (const b of tpl.blocks) {
      const orig = rows[b.id];
      if (!orig) {
        missing.push(b.id);
        continue;
      }
      const e = edits[b.id] || orig;
      const subject = (e.subject || '').trim();
      const body = b.noBody ? '' : (e.body || '').trim();
      if (tpl.requireAll && (!subject || !body)) {
        empty.push(b.id);
        continue;
      }
      if (subject === orig.subject && body === (orig.body || '')) continue; // unchanged
      toSave.push({ id: b.id, subject, body });
    }

    if (empty.length) {
      setMsg(m => ({ ...m, [tpl.key]: { type: 'error', text: `Subject and body can't be empty (${empty.join(', ')}). Nothing was saved.` } }));
      setSaving(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const failed: string[] = [];
      const saved: Row[] = [];
      for (const r of toSave) {
        const out = await sbPatch<Row>(`email_templates?id=eq.${encodeURIComponent(r.id)}`, {
          subject: r.subject,
          body: r.body,
          updated_at: now,
        });
        if (!out || out.length === 0) failed.push(r.id);
        else saved.push(r);
      }
      if (saved.length) {
        setRows(prev => {
          const next = { ...prev };
          saved.forEach(r => (next[r.id] = { ...next[r.id], ...r }));
          return next;
        });
      }
      if (failed.length || missing.length) {
        const parts: string[] = [];
        if (failed.length) parts.push(`not saved (blocked by the database): ${failed.join(', ')}`);
        if (missing.length) parts.push(`no row in the database for: ${missing.join(', ')}`);
        setMsg(m => ({ ...m, [tpl.key]: { type: 'error', text: parts.join('. ') + '.' } }));
      } else {
        setMsg(m => ({
          ...m,
          [tpl.key]: { type: 'success', text: toSave.length ? '✓ Templates saved.' : 'No changes to save.' },
        }));
      }
    } catch (e: any) {
      setMsg(m => ({ ...m, [tpl.key]: { type: 'error', text: 'Error saving: ' + (e.message || e) } }));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rm-empty">Loading templates…</div>;
  if (loadErr) return <div className="rm-msg error">Error: {loadErr}</div>;

  const m = msg[tpl.key];

  return (
    <div>
      <div className="rm-hint">
        <strong>Placeholders:</strong> <code>{tpl.hint}</code>
      </div>

      <div className="rm-selector">
        {TEMPLATES.map(t => (
          <button
            key={t.key}
            className={'rm-sel-btn' + (t.key === active ? ' active' : '')}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rm-card">
        <div className="rm-card-head">
          <span>{tpl.heading}</span>
          <button className="rm-btn rm-btn-green" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
        {m && <div className={'rm-msg ' + m.type}>{m.text}</div>}
        <div className="rm-grid">
          {tpl.blocks.map(b => {
            const e = edits[b.id];
            return (
              <div key={b.id} className={'rm-block' + (b.noBody ? ' rm-block-wide' : '')}>
                <div className="rm-block-title">{b.title}</div>
                {!e ? (
                  <div className="rm-missing">No “{b.id}” row found in email_templates.</div>
                ) : (
                  <>
                    <label>{b.subjectLabel}</label>
                    <input type="text" value={e.subject || ''} onChange={ev => setField(b.id, 'subject', ev.target.value)} />
                    {!b.noBody && (
                      <>
                        <label>Body</label>
                        <textarea value={e.body || ''} onChange={ev => setField(b.id, 'body', ev.target.value)} />
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}