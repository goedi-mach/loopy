import { useEffect, useState } from 'react';
import { sbGet } from './lib/api';

type Failure = {
  id: string;
  created_at: string;
  email: string | null;
  context: string | null;
  event_date: string | null;
  error: string | null;
  clients: { name: string | null } | null;
};
type EmailEvent = {
  id: string;
  created_at: string;
  event_type: string;
  email: string | null;
  clients: { name: string | null } | null;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReminderFailures() {
  const [fails, setFails] = useState<Failure[] | null>(null);
  const [events, setEvents] = useState<EmailEvent[] | null>(null);
  const [failErr, setFailErr] = useState('');
  const [evErr, setEvErr] = useState('');

  async function loadFails() {
    setFails(null);
    setFailErr('');
    try {
      setFails(await sbGet<Failure[]>('email_send_failures?select=*,clients(name)&order=created_at.desc,id.desc&limit=200'));
    } catch (e: any) {
      setFailErr(e.message || 'Could not load');
      setFails([]);
    }
  }

  async function loadEvents() {
    setEvents(null);
    setEvErr('');
    try {
      setEvents(
        await sbGet<EmailEvent[]>(
          'email_events?select=*,clients(name)&event_type=in.(bounced,complained,delivery_delayed)&order=created_at.desc,id.desc&limit=200'
        )
      );
    } catch (e: any) {
      setEvErr(e.message || 'Could not load');
      setEvents([]);
    }
  }

  useEffect(() => {
    loadFails();
    loadEvents();
  }, []);

  const badge: Record<string, string> = { bounced: 'bounced', complained: 'complained', delivery_delayed: 'delayed' };

  return (
    <div>
      <div className="rm-card">
        <div className="rm-card-head">
          <span>⚠️ Send Failures</span>
          <button className="rm-btn rm-btn-primary" onClick={loadFails}>Refresh</button>
        </div>
        {failErr && <div className="rm-msg error">Error: {failErr}</div>}
        <div className="rm-table-wrap">
          <table className="rm-table">
            <thead>
              <tr><th>Date</th><th>Client</th><th>Email</th><th>Context</th><th>Error</th></tr>
            </thead>
            <tbody>
              {fails === null ? (
                <tr><td colSpan={5} className="rm-empty">Loading…</td></tr>
              ) : fails.length === 0 ? (
                <tr><td colSpan={5} className="rm-empty">No send failures recorded.</td></tr>
              ) : (
                fails.map(r => (
                  <tr key={r.id}>
                    <td className="rm-small">{fmtDateTime(r.created_at)}</td>
                    <td>{r.clients?.name || '—'}</td>
                    <td className="rm-small">{r.email || '—'}</td>
                    <td className="rm-small">{r.context || '—'}{r.event_date ? ` · ${r.event_date}` : ''}</td>
                    <td className="rm-small rm-noemail">{r.error || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rm-card">
        <div className="rm-card-head">
          <span>📬 Bounces &amp; Complaints</span>
          <button className="rm-btn rm-btn-primary" onClick={loadEvents}>Refresh</button>
        </div>
        {evErr && <div className="rm-msg error">Error: {evErr}</div>}
        <div className="rm-table-wrap">
          <table className="rm-table">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Email</th><th>Client</th></tr>
            </thead>
            <tbody>
              {events === null ? (
                <tr><td colSpan={4} className="rm-empty">Loading…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={4} className="rm-empty">No bounces or complaints recorded.</td></tr>
              ) : (
                events.map(r => (
                  <tr key={r.id}>
                    <td className="rm-small">{fmtDateTime(r.created_at)}</td>
                    <td><span className={'rm-badge ' + (badge[r.event_type] || 'none')}>{r.event_type}</span></td>
                    <td className="rm-small">{r.email || '—'}</td>
                    <td>{r.clients?.name || <span className="rm-small">Unknown</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}