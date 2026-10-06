import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import SetPassword from './SetPassword'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<div className="login-page"><Login /></div>} />
        <Route path="/set-password" element={<div className="set-password-page"><SetPassword /></div>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}