import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './Landing'
import Login from './Login'
import SetPassword from './SetPassword'
import VolunteerHome from './VolunteerHome'
import RequireAuth from './components/RequireAuth'
import Intake from './Intake'
import Discharge from './Discharge'
import ClientProfile from './ClientProfile'
import PrintRecord from './PrintRecord'
import Records from './Records'
import Registration from './Registration'
import Reports from './Reports'
import RequireRole from './components/RequireRole'
import StaffHome from './StaffHome'
import BatchCerts from './BatchCerts'
import MergeClients from './MergeClients'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<div className="login-page"><Login /></div>} />
        <Route path="/set-password" element={<div className="set-password-page"><SetPassword /></div>} />
        <Route
          path="/volunteer-home"
          element={
            <RequireAuth>
              <div className="volunteer-page"><VolunteerHome /></div>
            </RequireAuth>
          }
        />
                <Route
          path="/intake"
          element={
            <RequireAuth>
              <Intake />
            </RequireAuth>
          }
        />
                <Route
          path="/discharge"
          element={
            <RequireAuth>
              <Discharge />
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