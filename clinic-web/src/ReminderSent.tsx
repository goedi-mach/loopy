import { useEffect, useState } from 'react';
import { sbGet, sbPatch } from './lib/api';
import { fmtDate, type RemRow } from './ReminderUpcoming';

export default function ReminderSent() {
  const [rows, setRows] = useState<RemRow[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setRows(null);
    setErr('');
    try {
      const data = await sbGet<RemRow[]>(
        `vaccinations?select=id,vaccine_name,next_due,reminder_2w_sent,reminder_1w_sent,pets(name,clients(name,email))` +
          `&or=(reminder_2w_sent.eq.true,reminder_1w_sent.eq.true)&order=next_due.desc,id.desc&limit=200`
      );
      setRows(data);
    } catch (e: any) {
      setErr(e.message || 'Could not load');
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function reset(id: string) {
    if (!window.confirm('Reset reminder flags? The cron job will re-send reminders for this record on its next run.')) return;
    setBusy(id);
    setErr('');
    try {
      const out = await sbPatch(`vaccinations?id=eq.${id}`, { reminder_2w_sent: false, reminder_1w_sent: false });
      if (!out || out.length === 0) throw new Error('The update was blocked, so the flags were not reset.');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Reset failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rm-card">
      <div className="rm-card-head">
        <span>Sent Reminder Log <span className="rm-sub">(latest 200)</span></span>
        <button className="rm-btn rm-btn-primary" onClick={load}>Refresh</button>
      </div>
      {err && <div className="rm-msg error">Error: {err}</div>}
      <div className="rm-table-wrap">
        <table className="rm-table">
          <thead>
            <tr>
              <th>Pet</th><th>Owner</th><th>Email</th><th>Vaccine</th><th>Due Date</th><th>2-Week Sent</th><th>1-Week Sent</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={8} className="rm-empty">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="rm-empty">No reminders sent yet.</td></tr>
            ) : (
              rows.map(r => {
                const pet = r.pets;
                const c = pet?.clients;
                return (
                  <tr key={r.id}>
                    <td><strong>{pet?.name || '—'}</strong></td>
                    <td>{c?.name || '—'}</td>
                    <td className="rm-small">{c?.email || '—'}</td>
                    <td className="rm-small">{r.vaccine_name || '—'}</td>
                    <td>{fmtDate(r.next_due)}</td>
                    <td>{r.reminder_2w_sent ? <span className="rm-badge sent">✓ Sent</span> : <span className="rm-badge none">—</span>}</td>
                    <td>{r.reminder_1w_sent ? <span className="rm-badge sent">✓ Sent</span> : <span className="rm-badge none">—</span>}</td>
                    <td>
                      <button className="rm-btn rm-btn-amber rm-btn-sm" disabled={busy === r.id} onClick={() => reset(r.id)}>
                        {busy === r.id ? '…' : 'Reset Flags'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}