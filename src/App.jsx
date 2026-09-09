import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Purchases from './pages/Purchases'
import Invoices from './pages/Invoices'
import Expenses from './pages/Expenses'
import Attendance from './pages/Attendance'
import StaffSalary from './pages/StaffSalary'
import Users from './pages/Users'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute allowedRoles={['owner']}><Dashboard /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute allowedRoles={['owner']}><Invoices /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute allowedRoles={['owner']}><StaffSalary /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute allowedRoles={['owner']}><Users /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}
