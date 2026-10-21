import { useCallback, useEffect, useState, type FormEvent } from 'react'
import ClinicNav from './components/ClinicNav'
import './Intake.css'

type Role = 'volunteer' | 'staff' | 'admin'

const ROLES: { value: Role; label: string }[] = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
]

interface AdminUser {
  id: string
  email: string
  created_at?: string
  last_sign_in_at?: string | null
  app_metadata?: { role?: string }
}

interface Msg {
  type: 'error' | 'success'
  text: string
}

async function adminApi(method: 'GET' | 'POST', opts: { query?: string; body?: unknown } = {}) {
  const res = await fetch(`/api/admin-users${opts.query || ''}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('php_token')}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const hint = res.status === 404 ? ' (this API only runs on a deployed preview)' : ''
    throw new Error((data?.error || `Request failed (${res.status})`) + hint)
  }
  return data
}

// Who is signed in: user id from the login token, plus email as a fallback
function whoAmI() {
  let id = ''
  try {
    const token = localStorage.getItem('php_token') || ''
    id = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''
  } catch {
    /* no token */
  }
  return { id, email: (localStorage.getItem('php_email') || '').toLowerCase() }
}

const fmtJoined = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const errText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('volunteer')
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const [resentId, setResentId] = useState<string | null>(null)

  const me = whoAmI()

  const load = useCallback(async () => {
    try {
      const data = await adminApi('GET', { query: '?action=list' })
      setUsers(data.users || [])
      setLoadError('')
    } catch (err) {
      setLoadError(errText(err))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Messages fade after 5 seconds
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 5000)
    return () => clearTimeout(t)
  }, [msg])

  async function invite(e: FormEvent) {
    e.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!addr) return setMsg({ type: 'error', text: 'Please enter an email address.' })
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setMsg({ type: 'error', text: 'That does not look like an email address.' })
    setInviting(true)
    try {
      await adminApi('POST', { body: { action: 'invite', email: addr, role } })
      setMsg({ type: 'success', text: `Invite sent to ${addr}.` })
      setEmail('')
      await load()
    } catch (err) {
      setMsg({ type: 'error', text: errText(err) })
    } finally {
      setInviting(false)
    }
  }

  async function changeRole(u: AdminUser, next: Role) {
    const warn = next === 'admin' ? '\n\nAdmins can invite users and change anyone\'s role.' : ''
    if (!confirm(`Change ${u.email} to ${next}?${warn}`)) return
    try {
      await adminApi('POST', { body: { action: 'set_role', userId: u.id, role: next } })
      setMsg({
        type: 'success',
        text: `${u.email} is now ${next}. It can take up to an hour, or their next sign-in, to take effect.`,
      })
      await load()
    } catch (err) {
      setMsg({ type: 'error', text: `Could not update role: ${errText(err)}` })
    }
  }

  async function resend(u: AdminUser) {
    if (!confirm(`Resend invite email to ${u.email}?`)) return
    setResending(u.id)
    try {
      await adminApi('POST', { body: { action: 'resend_invite', email: u.email } })
      setResentId(u.id)
      setTimeout(() => setResentId((cur) => (cur === u.id ? null : cur)), 3000)
    } catch (err) {
      setMsg({ type: 'error', text: `Could not resend invite: ${errText(err)}` })
    } finally {
      setResending(null)
    }
  }

  // Only some versions of the API return sign-in info. When it's missing, offer Resend for everyone, like the old page.
  const hasSignInInfo = !!users?.some((u) => 'last_sign_in_at' in u)

  return (
    <div className="intake">
      <ClinicNav active="users" />
      <div className="records-main">
        <div className="page-title">👥 User Management</div>

        {msg && <div className={msg.type === 'error' ? 'warning-bar' : 'sh-success'}>{msg.text}</div>}

        <div className="sh-section">Invite</div>
        <div className="card">
          <div className="card-header"><span>➕ Invite New User</span></div>
          <div className="card-body">
            <form onSubmit={invite}>
              <div className="sh-row">
                <div className="sh-field">
                  <label>Email</label>
                  <input type="email" value={email} placeholder="volunteer@example.com" onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="sh-field">
                  <label>Role</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={inviting}>{inviting ? 'Sending…' : 'Send Invite'}</button>
            </form>
          </div>
        </div>

        <div className="sh-section sh-section-gap">All Users</div>
        <div className="card">
          {loadError && <div className="warning-bar" style={{ margin: '1rem' }}>Error: {loadError}</div>}
          {!users && !loadError && <div className="state-msg">Loading users…</div>}
          {users && users.length === 0 && <div className="state-msg">No users found.</div>}
          {users && users.length > 0 && (
            <div className="table-wrap">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    {hasSignInInfo && <th>Status</th>}
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const userRole = (u.app_metadata?.role as Role) || 'volunteer'
                    const isMe = (!!me.id && u.id === me.id) || (!!me.email && u.email?.toLowerCase() === me.email)
                    const pending = hasSignInInfo && !u.last_sign_in_at
                    return (
                      <tr key={u.id}>
                        <td>
                          {u.email}
                          {isMe && <span className="um-you"> (you)</span>}
                        </td>
                        <td><span className={`um-badge ${userRole}`}>{userRole}</span></td>
                        {hasSignInInfo && (
                          <td>{pending ? <span className="sh-pill warn">Invited</span> : <span className="sh-pill done">Active</span>}</td>
                        )}
                        <td style={{ color: 'var(--text-muted)' }}>{fmtJoined(u.created_at)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {isMe ? (
                            <span className="um-you">—</span>
                          ) : (
                            <>
                              <select className="um-select" value={userRole} onChange={(e) => changeRole(u, e.target.value as Role)}>
                                {ROLES.map((r) => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                              {(!hasSignInInfo || pending) && (
                                <button
                                  type="button"
                                  className="sh-mini"
                                  style={{ marginLeft: '0.4rem' }}
                                  disabled={resending === u.id}
                                  onClick={() => resend(u)}
                                >
                                  {resending === u.id ? 'Sending…' : resentId === u.id ? '✓ Sent' : 'Resend invite'}
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}