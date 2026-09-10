import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Purchases from './pages/Purchases'
import Quotations from './pages/Quotations'
import Invoices from './pages/Invoices'
import DeliveryChallans from './pages/DeliveryChallans'
import CreditDebitNotes from './pages/CreditDebitNotes'
import PartyLedger from './pages/PartyLedger'
import ItemMaster from './pages/ItemMaster'
import Expenses from './pages/Expenses'
import Attendance from './pages/Attendance'
import StaffSalary from './pages/StaffSalary'
import BusinessSettings from './pages/BusinessSettings'
import Users from './pages/Users'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute allowedRoles={['owner']}><Dashboard /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
        <Route path="/quotations" element={<ProtectedRoute allowedRoles={['owner']}><Quotations /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute allowedRoles={['owner']}><Invoices /></ProtectedRoute>} />
        <Route path="/challans" element={<ProtectedRoute allowedRoles={['owner']}><DeliveryChallans /></ProtectedRoute>} />
        <Route path="/credit-debit-notes" element={<ProtectedRoute allowedRoles={['owner']}><CreditDebitNotes /></ProtectedRoute>} />
        <Route path="/ledger" element={<ProtectedRoute allowedRoles={['owner']}><PartyLedger /></ProtectedRoute>} />
        <Route path="/item-master" element={<ProtectedRoute allowedRoles={['owner']}><ItemMaster /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute allowedRoles={['owner']}><StaffSalary /></ProtectedRoute>} />
        <Route path="/business-settings" element={<ProtectedRoute allowedRoles={['owner']}><BusinessSettings /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute allowedRoles={['owner']}><Users /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  )
}
