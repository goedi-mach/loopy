import { useState } from 'react';
import ClinicNav from './components/ClinicNav';
import ReminderTemplates from './ReminderTemplates';
import ReminderUpcoming from './ReminderUpcoming';
import ReminderSent from './ReminderSent';
import ReminderManual from './ReminderManual';
import ReminderFailures from './ReminderFailures';
import ReminderTriggers from './ReminderTriggers';
import './Intake.css';

type Tab = 'templates' | 'upcoming' | 'sent' | 'manual' | 'triggers' | 'failures';

const TABS: { id: Tab; label: string }[] = [
  { id: 'templates', label: '✏️ Templates' },
  { id: 'upcoming', label: '📅 Upcoming' },
  { id: 'sent', label: '✅ Sent Log' },
  { id: 'manual', label: '📨 Manual Send' },
  { id: 'failures', label: '⚠️ Failures' },
  { id: 'triggers', label: '⚡ Triggers' },
];

export default function Reminders() {
  const [tab, setTab] = useState<Tab>('templates');

  return (
    <div className="intake">
      <ClinicNav active="reminders" />
      <main className="rm-main">
        <div className="rm-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={'rm-tab' + (tab === t.id ? ' active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'templates' && <ReminderTemplates />}
        {tab === 'upcoming' && <ReminderUpcoming />}
        {tab === 'sent' && <ReminderSent />}
        {tab === 'manual' && <ReminderManual />}
        {tab === 'failures' && <ReminderFailures />}
        {tab === 'triggers' && <ReminderTriggers />}
      </main>
    </div>
  );
}