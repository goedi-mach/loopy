import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './Landing'
import Login from './Login'
import SetPassword from './SetPassword'
import VolunteerHome from './VolunteerHome'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<div className="login-page"><Login /></div>} />
        <Route path="/set-password" element={<div className="set-password-page"><SetPassword /></div>} />
        <Route path="/volunteer-home" element={<div className="volunteer-page"><VolunteerHome /></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}