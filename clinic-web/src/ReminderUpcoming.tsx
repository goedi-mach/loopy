import { useEffect, useState } from 'react';
import { sbGetAll } from './lib/api';
import { todayStr } from './lib/dates';

export type RemRow = {
  id: string;
  vaccine_name: string | null;
  next_due: string | null;
  reminder_2w_sent: boolean | null;
  reminder_1w_sent: boolean | null;
  pets: { name: string | null; clients: { name: string | null; email: string | null } | null } | null;
};

export function fmtDate(d?: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function plusDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export default function ReminderUpcoming() {
  const [rows, setRows] = useState<RemRow[] | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    setRows(null);
    setErr('');
    try {
      const today = todayStr();
      const in30 = plusDays(today, 30);
      const data = await sbGetAll<RemRow>(
        `vaccinations?select=id,vaccine_name,next_due,reminder_2w_sent,reminder_1w_sent,pets(name,clients(name,email))` +
          `&next_due=gte.${today}&next_due=lte.${in30}&order=next_due.asc,id.asc`
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

  return (
    <div className="rm-card">
      <div className="rm-card-head">
        <span>Upcoming Reminders — Next 30 Days</span>
        <button className="rm-btn rm-btn-primary" onClick={load}>Refresh</button>
      </div>
      {err && <div className="rm-msg error">Error: {err}</div>}
      <div className="rm-table-wrap">
        <table className="rm-table">
          <thead>
            <tr>
              <th>Pet</th><th>Owner</th><th>Email</th><th>Vaccine</th><th>Due Date</th><th>2-Week</th><th>1-Week</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={7} className="rm-empty">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="rm-empty">No upcoming reminders in the next 30 days.</td></tr>
            ) : (
              rows.map(r => {
                const pet = r.pets;
                const c = pet?.clients;
                return (
                  <tr key={r.id}>
                    <td><strong>{pet?.name || '—'}</strong></td>
                    <td>{c?.name || '—'}</td>
                    <td className="rm-small">{c?.email || <span className="rm-noemail">No email</span>}</td>
                    <td className="rm-small">{r.vaccine_name || '—'}</td>
                    <td>{fmtDate(r.next_due)}</td>
                    <td>{r.reminder_2w_sent ? <span className="rm-badge sent">Sent</span> : <span className="rm-badge pending">Pending</span>}</td>
                    <td>{r.reminder_1w_sent ? <span className="rm-badge sent">Sent</span> : <span className="rm-badge pending">Pending</span>}</td>
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