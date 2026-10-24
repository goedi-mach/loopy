import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './Landing'
import Login from './Login'
import SetPassword from './SetPassword'
import VolunteerHome from './VolunteerHome'
import RequireAuth from './components/RequireAuth'
import Clinic from './Clinic'
import ClientProfile from './ClientProfile'
import PrintRecord from './PrintRecord'
import Records from './Records'
import Registration from './Registration'
import Reports from './Reports'
import RequireRole from './components/RequireRole'
import StaffHome from './StaffHome'
import BatchCerts from './BatchCerts'
import MergeClients from './MergeClients'
import UserManagement from './UserManagement'
import Reminders from './Reminders'

// Old invite/reset links point at /set-password.html. Keep the "#access_token=…" part when redirecting.
function SetPasswordRedirect() {
  const l = useLocation()
  return <Navigate to={{ pathname: '/set-password', search: l.search, hash: l.hash }} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<div className="login-page"><Login /></div>} />
        <Route path="/set-password" element={<div className="set-password-page"><SetPassword /></div>} />
        <Route path="/set-password.html" element={<SetPasswordRedirect />} />
        <Route
          path="/volunteer-home"
          element={
            <RequireAuth>
              <div className="volunteer-page"><VolunteerHome /></div>
            </RequireAuth>
          }
        />
                <Route
          path="/clinic"
          element={
            <RequireAuth>
              <Clinic />
            </RequireAuth>
          }
        />
                <Route
          path="/discharge"
          element={
            <RequireAuth>
              <Navigate to="/clinic" replace />
            </RequireAuth>
          }
        />
                <Route
          path="/client/:id"
          element={
            <RequireAuth>
              <ClientProfile />
            </RequireAuth>
          }
        />
                <Route
          path="/records"
          element={
            <RequireAuth>
              <Records />
            </RequireAuth>
          }
        />

                <Route
          path="/reports"
          element={
            <RequireAuth>
              <RequireRole roles={['staff', 'admin']}>
                <Reports />
              </RequireRole>
            </RequireAuth>
          }
        />
                <Route
          path="/staff-home"
          element={
            <RequireAuth>
              <RequireRole roles={['staff', 'admin']}>
                <StaffHome />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="/staff-home.html" element={<Navigate to="/staff-home" replace />} />
        <Route path="/intake" element={<Navigate to="/clinic" replace />} />
                <Route
          path="/tools/batch-certs"
          element={
            <RequireAuth>
              <RequireRole roles={['staff', 'admin']}>
                <BatchCerts />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/tools/merge-clients"
          element={
            <RequireAuth>
              <RequireRole roles={['staff', 'admin']}>
                <MergeClients />
              </RequireRole>
            </RequireAuth>
          }
        />
                <Route
          path="/tools/user-management"
          element={
            <RequireAuth>
              <RequireRole roles={['admin']}>
                <UserManagement />
              </RequireRole>
            </RequireAuth>
          }
        />
                <Route
          path="/tools/reminders"
          element={
            <RequireAuth>
              <RequireRole roles={['staff', 'admin']}>
                <Reminders />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="/tools/reminders.html" element={<Navigate to="/tools/reminders" replace />} />
        <Route path="/tools/user-management.html" element={<Navigate to="/tools/user-management" replace />} />
        <Route path="/tools/batch-certs.html" element={<Navigate to="/tools/batch-certs" replace />} />
        <Route path="/tools/merge-clients.html" element={<Navigate to="/tools/merge-clients" replace />} />
                <Route
          path="/client/:id/print/:petId"
          element={
            <RequireAuth>
              <PrintRecord />
            </RequireAuth>
          }
        />
        <Route path="/registration" element={<Registration />} />
        <Route path="/registration.html" element={<Registration />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}