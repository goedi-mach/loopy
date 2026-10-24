import { useEffect, useState } from 'react';
import { sbGet } from './lib/api';
import { apiPost } from './reminderApi';

type Ev = {
  id: string;
  event_date: string;
  location: string | null;
  clinic_type: string | null;
  completed: boolean | null;
};
type Variant = {
  triggerNames: string[];
  recipientCount: number;
  sampleClient: string;
  subject: string;
  html: string;
};
type Preview = { totalRecipients: number; skipped: number; variants: Variant[] };
type SendRes = { sent: number; skipped: number; done: boolean; nextOffset: number; totalClients?: number; logFailures?: number; };
type Msg = { type: 'success' | 'error' | 'info'; text: string } | null;
type Previewed = { eventId: string; eventDate: string; clinicType: string; testClientId: string | null };

function fmt(d: string, long = false) {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(
    'en-US',
    long
      ? { month: 'long', day: 'numeric', year: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  );
}

export default function ReminderPostClinic() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [eventId, setEventId] = useState('');
  const [testClientId, setTestClientId] = useState('');
  const [previewed, setPreviewed] = useState<Previewed | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [variant, setVariant] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendLabel, setSendLabel] = useState('');
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    (async () => {
      try {
        const ev = await sbGet<Ev[]>('events?select=id,event_date,location,clinic_type,completed&order=event_date.desc,id.desc&limit=30');
        setEvents(ev);
        if (ev.length) setEventId(ev[0].id);
      } catch (e: any) {
        setEvents([]);
        setMsg({ type: 'error', text: 'Could not load clinics: ' + (e.message || e) });
      }
    })();
  }, []);

  const ev = events?.find(e => e.id === eventId) || null;

  function resetPreview() {
    setPreviewed(null);
    setPreview(null);
  }

  async function runPreview() {
    if (!ev) {
      setMsg({ type: 'error', text: 'Please select a clinic event.' });
      return;
    }
    const clinicType = ev.clinic_type || 'Clinic';
    const tid = testClientId.trim() || null;
    setLoadingPreview(true);
    setSending(false);
    setPreviewed(null);
    setMsg(null);
    try {
      const data = await apiPost<Preview>('/api/send-postclinic', {
        eventDate: ev.event_date,
        clinicType,
        preview: true,
        testClientId: tid,
      });
      if (!data || !Array.isArray(data.variants)) throw new Error('Unexpected preview response.');
      setPreview(data);
      setPreviewed({ eventId: ev.id, eventDate: ev.event_date, clinicType, testClientId: tid });
      setVariant(0);
      setModalOpen(true);
      setMsg({ type: 'success', text: tid ? '✓ Test preview ready.' : '✓ Preview ready.' });
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error: ' + (e.message || e) });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function send() {
    if (!previewed) {
      setMsg({ type: 'error', text: 'Please preview before sending.' });
      return;
    }
    const { eventDate, clinicType, testClientId: tid } = previewed;
    const when = fmt(eventDate, true);
    const q = tid
      ? `Send a TEST post-clinic email (using ${clinicType} on ${when}) to client ID ${tid} only?`
      : `Send post-clinic emails to everyone registered for ${clinicType} on ${when}?`;
    if (!window.confirm(q)) return;

    setSending(true);
    let offset = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalLogFail = 0;
    let done = false;
    let rounds = 0;

    try {
      while (!done) {
        if (++rounds > 200) throw new Error('Too many batches, stopping for safety.');
        setSendLabel(`Sending… (${totalSent} sent so far)`);
        setMsg({ type: 'info', text: `Sending batch starting at ${offset}…` });

        const data = await apiPost<SendRes>('/api/send-postclinic', {
          eventDate,
          clinicType,
          offset,
          batchSize: 40,
          testClientId: tid,
        });

        totalSent += data.sent || 0;
        totalSkipped += data.skipped || 0;
        totalLogFail += data.logFailures || 0;
        done = !!data.done;
        if (!done && !(data.nextOffset > offset)) {
          throw new Error('The server did not advance to the next batch.');
        }
        offset = data.nextOffset;
        setMsg({
          type: 'info',
          text: `${totalSent} sent so far${data.totalClients ? ` of ~${data.totalClients}` : ''}…`,
        });
      }
           setMsg({
        type: totalLogFail ? 'error' : 'success',
        text:
          `✓ Done! Sent to ${totalSent} client${totalSent === 1 ? '' : 's'}. Skipped ${totalSkipped}.` +
          (totalLogFail
            ? ` WARNING: ${totalLogFail} emails went out but could not be logged. Do not re-run this clinic until that is fixed, or those people will be emailed twice.`
            : ''),
      });
    } catch (e: any) {
      setMsg({
        type: 'error',
        text: `Stopped after ${totalSent} sent: ${e.message || e}. Check the Failures tab before trying again.`,
      });
    } finally {
      // Always force a fresh preview so nobody re-sends blindly.
      resetPreview();
      setSending(false);
      setSendLabel('');
    }
  }

  const v = preview?.variants[variant];

  return (
    <div className="rm-card">
      <div className="rm-card-head">📨 Send Post-Clinic Email</div>
      <div className="rm-pad">
        <p className="rm-note">
          Sends to every client registered for the selected clinic, with chip / spay-neuter blocks applied
          automatically based on active triggers. Preview first.
        </p>
        <div className="rm-row">
          <div className="rm-field rm-grow">
            <label>Clinic Event</label>
            <select
              value={eventId}
              onChange={e => {
                setEventId(e.target.value);
                resetPreview();
              }}
              disabled={sending}
            >
              {events === null && <option value="">Loading clinics…</option>}
              {events !== null && events.length === 0 && <option value="">No clinic events found</option>}
              {events?.map(e => (
                <option key={e.id} value={e.id}>
                  {fmt(e.event_date)} — {e.location || 'No location'} ({e.clinic_type || 'Clinic'})
                </option>
              ))}
            </select>
          </div>
          <div className="rm-field">
            <label>Test Client ID (optional)</label>
            <input
              type="text"
              value={testClientId}
              placeholder="e.g. bd580dd4-0732-…"
              onChange={e => {
                setTestClientId(e.target.value);
                resetPreview();
              }}
              disabled={sending}
            />
          </div>
          <button className="rm-btn rm-btn-primary" onClick={runPreview} disabled={loadingPreview || sending || !ev}>
            {loadingPreview ? 'Loading preview…' : '👁 Preview Emails'}
          </button>
          <button
            className="rm-btn rm-btn-green"
            onClick={send}
            disabled={!previewed || sending}
            title={previewed ? '' : 'Preview first'}
          >
            {sending ? sendLabel : 'Send Post-Clinic Email'}
          </button>
        </div>
        {msg && <div className={'rm-msg-inline ' + msg.type}>{msg.text}</div>}
      </div>

      {modalOpen && preview && v && (
        <div className="rm-modal-bg" onClick={() => setModalOpen(false)}>
          <div className="rm-modal" onClick={e => e.stopPropagation()}>
            <div className="rm-modal-head">
              <div>
                <div className="rm-modal-title">Email Preview</div>
                <div className="rm-small">
                  {preview.totalRecipients} recipient{preview.totalRecipients === 1 ? '' : 's'} with email ·{' '}
                  {preview.variants.length} distinct version{preview.variants.length === 1 ? '' : 's'} ·{' '}
                  {preview.skipped} skipped (no email)
                </div>
              </div>
              <button className="rm-x" onClick={() => setModalOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="rm-selector rm-modal-tabs">
              {preview.variants.map((vv, i) => (
                <button
                  key={i}
                  className={'rm-sel-btn' + (i === variant ? ' active' : '')}
                  onClick={() => setVariant(i)}
                >
                  {vv.triggerNames.length ? vv.triggerNames.join(' + ') : 'Base email only'} ({vv.recipientCount})
                </button>
              ))}
            </div>
            <div className="rm-modal-body">
              <div className="rm-small" style={{ marginBottom: '.5rem' }}>
                Sample recipient: <strong>{v.sampleClient}</strong> · Subject: <strong>{v.subject}</strong>
              </div>
              <iframe className="rm-frame" title="Email preview" srcDoc={v.html} sandbox="" />
            </div>
            <div className="rm-modal-foot">
              <button className="rm-btn rm-btn-ghost" onClick={() => setModalOpen(false)}>Close</button>
              <button
                className="rm-btn rm-btn-green"
                onClick={() => {
                  setModalOpen(false);
                  send();
                }}
              >
                Looks Good — Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}