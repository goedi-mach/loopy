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
          path="/client/:id/print/:petId"
          element={
            <RequireAuth>
              <PrintRecord />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}