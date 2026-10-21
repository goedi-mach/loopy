import { useEffect, useRef, useState } from 'react';
import { sbGet } from './lib/api';
import { apiPost } from './reminderApi';
import { fmtDate } from './ReminderUpcoming';
import ReminderPostClinic from './ReminderPostClinic';

type PetRow = {
  id: string;
  name: string | null;
  client_id: string;
  clients: { id: string; name: string | null; email: string | null } | null;
};
type Vax = {
  id: string;
  pet_id: string;
  vaccine_name: string | null;
  next_due: string | null;
  reminder_2w_sent: boolean | null;
  reminder_1w_sent: boolean | null;
};
type Result = { vax: Vax; pet: PetRow };
type Msg = { type: 'success' | 'error' | 'info'; text: string } | null;

const MAX_PETS = 100;

export default function ReminderManual() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.replace(/[*%,()]/g, ' ').trim();
    if (term.length < 2) {
      setResults(null);
      setNote('');
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      setNote('');
      try {
        const enc = encodeURIComponent(term);
        const [cl, petsByName] = await Promise.all([
          sbGet<{ id: string }[]>(`clients?select=id&archived=eq.false&name=ilike.*${enc}*&limit=50`),
          sbGet<PetRow[]>(
            `pets?select=id,name,client_id,clients(id,name,email)&archived=eq.false&name=ilike.*${enc}*&limit=50`
          ),
        ]);

        let petsFromClients: PetRow[] = [];
        if (cl.length) {
          petsFromClients = await sbGet<PetRow[]>(
            `pets?select=id,name,client_id,clients(id,name,email)&archived=eq.false&client_id=in.(${cl
              .map(c => c.id)
              .join(',')})`
          );
        }

        const petMap = new Map<string, PetRow>();
        [...petsByName, ...petsFromClients].forEach(p => petMap.set(p.id, p));
        let pets = [...petMap.values()];
        if (pets.length > MAX_PETS) {
          pets = pets.slice(0, MAX_PETS);
          if (mine === seq.current) setNote(`Showing the first ${MAX_PETS} pets. Narrow your search.`);
        }

        let out: Result[] = [];
        if (pets.length) {
          const vax = await sbGet<Vax[]>(
            `vaccinations?select=id,pet_id,vaccine_name,next_due,reminder_2w_sent,reminder_1w_sent` +
              `&pet_id=in.(${pets.map(p => p.id).join(',')})&next_due=not.is.null&order=next_due.asc,id.asc`
          );
          out = vax.map(v => ({ vax: v, pet: petMap.get(v.pet_id)! })).filter(r => r.pet);
        }
        if (mine === seq.current) setResults(out);
      } catch (e: any) {
        if (mine === seq.current) {
          setResults([]);
          setMsg({ type: 'error', text: 'Search error: ' + (e.message || e) });
        }
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, refresh]);

  async function sendOne(r: Result, type: '2w' | '1w') {
    const label = type === '2w' ? '2-week' : '1-week';
    const petName = r.pet.name || 'this pet';
    const email = r.pet.clients?.email || '';
    if (!window.confirm(`Send the ${label} reminder for ${petName} to ${email}?`)) return;
    setSendingId(r.vax.id + type);
    setMsg({ type: 'info', text: `Sending ${label} reminder for ${petName}…` });
    try {
            const out = await apiPost<{ ok: boolean; warning?: string }>('/api/send-reminder-manual', {
        vaccinationId: r.vax.id,
        type,
      });
      setMsg(
        out.warning
          ? { type: 'error', text: `${label} reminder emailed for ${petName}. WARNING: ${out.warning}` }
          : { type: 'success', text: `✓ ${label} reminder sent for ${petName}.` }
      );
      setRefresh(n => n + 1);
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error: ' + (e.message || e) });
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div>
      <ReminderPostClinic />

      <div className="rm-card">
        <div className="rm-card-head">Send a Single Reminder</div>
        <div className="rm-pad">
          <div className="rm-field" style={{ maxWidth: 360 }}>
            <label>Owner or Pet Name</label>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" />
          </div>
          {msg && <div className={'rm-msg-inline ' + msg.type}>{msg.text}</div>}
          {note && <div className="rm-small" style={{ marginTop: '.5rem' }}>{note}</div>}
        </div>
        <div className="rm-table-wrap">
          <table className="rm-table">
            <thead>
              <tr>
                <th>Pet</th><th>Owner</th><th>Email</th><th>Vaccine</th><th>Due Date</th><th>2-Week</th><th>1-Week</th><th>Send</th>
              </tr>
            </thead>
            <tbody>
              {searching && results === null ? (
                <tr><td colSpan={8} className="rm-empty">Searching…</td></tr>
              ) : results === null ? (
                <tr><td colSpan={8} className="rm-empty">Search for a client or pet above.</td></tr>
              ) : results.length === 0 ? (
                <tr><td colSpan={8} className="rm-empty">{searching ? 'Searching…' : 'No results found.'}</td></tr>
              ) : (
                results.map(r => {
                  const c = r.pet.clients;
                  const hasEmail = !!c?.email;
                  return (
                    <tr key={r.vax.id}>
                      <td><strong>{r.pet.name || '—'}</strong></td>
                      <td>{c?.name || '—'}</td>
                      <td className="rm-small">{c?.email || <span className="rm-noemail">No email</span>}</td>
                      <td className="rm-small">{r.vax.vaccine_name || '—'}</td>
                      <td>{fmtDate(r.vax.next_due)}</td>
                      <td>{r.vax.reminder_2w_sent ? <span className="rm-badge sent">Sent</span> : <span className="rm-badge none">—</span>}</td>
                      <td>{r.vax.reminder_1w_sent ? <span className="rm-badge sent">Sent</span> : <span className="rm-badge none">—</span>}</td>
                      <td>
                        <div className="rm-btns">
                          <button className="rm-btn rm-btn-primary rm-btn-sm" disabled={!hasEmail || sendingId !== null} title={hasEmail ? '' : 'No email on file'} onClick={() => sendOne(r, '2w')}>2-Week</button>
                          <button className="rm-btn rm-btn-primary rm-btn-sm" disabled={!hasEmail || sendingId !== null} title={hasEmail ? '' : 'No email on file'} onClick={() => sendOne(r, '1w')}>1-Week</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}