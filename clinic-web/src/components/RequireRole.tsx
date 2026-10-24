import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getRole } from '../lib/auth'

// Sends anyone without one of the listed roles to the volunteer home.
// This only hides the page; the database rules decide what data a token can read.
export default function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  if (!roles.includes(getRole() || '')) return <Navigate to="/volunteer-home" replace />
  return <>{children}</>
}