import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const emptyStaffForm = { id: null, name: '', designation: '', fixed_salary: '', phone: '' }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function StaffSalary() {
  const { session } = useAuth()
  const [staffMembers, setStaffMembers] = useState([])
  const [salaryPayments, setSalaryPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const [showStaffModal, setShowStaffModal] = useState(false)
  const [staffForm, setStaffForm] = useState(emptyStaffForm)

  const [payModal, setPayModal] = useState(null) // staff member object
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1)
  const [payYear, setPayYear] = useState(new Date().getFullYear())
  const [bonus, setBonus] = useState('')
  const [deduction, setDeduction] = useState('')
  const [advance, setAdvance] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [staffRes, salRes] = await Promise.all([
      supabase.from('staff_members').select('*').eq('active', true).order('name'),
      supabase.from('salary_payments').select('*, staff_members(name)').order('year', { ascending: false }).order('month', { ascending: false }),
    ])
    if (staffRes.data) setStaffMembers(staffRes.data)
    if (salRes.data) setSalaryPayments(salRes.data)
    setLoading(false)
  }

  function openAddStaff() {
    setStaffForm(emptyStaffForm)
    setShowStaffModal(true)
  }

  function openEditStaff(s) {
    setStaffForm({ id: s.id, name: s.name, designation: s.designation || '', fixed_salary: s.fixed_salary, phone: s.phone || '' })
    setShowStaffModal(true)
  }

  async function handleSaveStaff(e) {
    e.preventDefault()
    const payload = {
      name: staffForm.name, designation: staffForm.designation || null,
      fixed_salary: Number(staffForm.fixed_salary) || 0, phone: staffForm.phone || null,
    }
    let error
    if (staffForm.id) {
      ;({ error } = await supabase.from('staff_members').update(payload).eq('id', staffForm.id))
    } else {
      ;({ error } = await supabase.from('staff_members').insert(payload))
    }
    if (error) alert('Error: ' + error.message)
    else {
      setShowStaffModal(false)
      loadAll()
    }
  }

  async function handleDeactivateStaff(s) {
    if (!confirm(`Remove "${s.name}" from active staff? Past salary/attendance records are kept.`)) return
    await supabase.from('staff_members').update({ active: false }).eq('id', s.id)
    loadAll()
  }

  function openPayModal(staff) {
    setPayModal(staff)
    setBonus(''); setDeduction(''); setAdvance(''); setNotes('')
    setPayMonth(new Date().getMonth() + 1)
    setPayYear(new Date().getFullYear())
  }

  const netPay = payModal
    ? Number(payModal.fixed_salary) + (Number(bonus) || 0) - (Number(deduction) || 0) - (Number(advance) || 0)
    : 0

  async function handleRunPayroll(e) {
    e.preventDefault()
    const { error } = await supabase.from('salary_payments').upsert({
      staff_member_id: payModal.id,
      month: payMonth,
      year: payYear,
      base_salary: payModal.fixed_salary,
      bonus: Number(bonus) || 0,
      deduction: Number(deduction) || 0,
      advance_deducted: Number(advance) || 0,
      net_pay: netPay,
      paid_on: new Date().toISOString().slice(0, 10),
      status: 'paid',
      notes: notes || null,
      created_by: session.user.id,
    }, { onConflict: 'staff_member_id,month,year' })

    if (error) alert('Error: ' + error.message)
    else {
      setPayModal(null)
      loadAll()
    }
  }

  const totalMonthlyPayroll = staffMembers.reduce((sum, s) => sum + Number(s.fixed_salary), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Staff & Salary</h1>
          <p className="text-titan-steel text-sm">{staffMembers.length} staff · Monthly payroll: ₹{totalMonthlyPayroll.toLocaleString('en-IN')}</p>
        </div>
        <button onClick={openAddStaff} className="btn-primary">+ Add Staff</button>
      </div>

      {/* Staff list */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr><th>Name</th><th>Designation</th><th>Fixed Salary</th><th>Phone</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {staffMembers.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.designation || '—'}</td>
                  <td>₹{Number(s.fixed_salary).toLocaleString('en-IN')}</td>
                  <td>{s.phone || '—'}</td>
                  <td className="space-x-2">
                    <button onClick={() => openPayModal(s)} className="text-titan-gold text-xs hover:underline">Pay Salary</button>
                    <button onClick={() => openEditStaff(s)} className="text-titan-gold text-xs hover:underline">Edit</button>
                    <button onClick={() => handleDeactivateStaff(s)} className="text-red-500 text-xs hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
              {staffMembers.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">No staff members yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Salary payment history */}
      <div>
        <h2 className="font-semibold text-titan-dark mb-2">Salary Payment History</h2>
        <div className="card overflow-x-auto p-0">
          <table className="data-table w-full">
            <thead>
              <tr><th>Staff</th><th>Month</th><th>Base</th><th>Bonus</th><th>Deduction</th><th>Advance</th><th>Net Pay</th><th>Paid On</th></tr>
            </thead>
            <tbody>
              {salaryPayments.map((sp) => (
                <tr key={sp.id}>
                  <td className="font-medium">{sp.staff_members?.name}</td>
                  <td className="text-xs">{MONTHS[sp.month - 1]} {sp.year}</td>
                  <td>₹{Number(sp.base_salary).toLocaleString('en-IN')}</td>
                  <td className="text-green-600">+₹{Number(sp.bonus).toLocaleString('en-IN')}</td>
                  <td className="text-red-600">-₹{Number(sp.deduction).toLocaleString('en-IN')}</td>
                  <td className="text-red-600">-₹{Number(sp.advance_deducted).toLocaleString('en-IN')}</td>
                  <td className="font-semibold">₹{Number(sp.net_pay).toLocaleString('en-IN')}</td>
                  <td className="text-xs">{sp.paid_on ? new Date(sp.paid_on).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {salaryPayments.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">No salary payments recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowStaffModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">{staffForm.id ? 'Edit Staff' : 'Add Staff'}</h2>
            </div>
            <form onSubmit={handleSaveStaff} className="p-5 space-y-3">
              <div>
                <label className="label">Name *</label>
                <input required className="input-field" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Designation</label>
                <input className="input-field" value={staffForm.designation} onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })} placeholder="Fabricator, Helper, Supervisor..." />
              </div>
              <div>
                <label className="label">Fixed Monthly Salary (₹) *</label>
                <input required type="number" step="any" className="input-field" value={staffForm.fixed_salary} onChange={(e) => setStaffForm({ ...staffForm, fixed_salary: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Save</button>
                <button type="button" onClick={() => setShowStaffModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">Pay Salary — {payModal.name}</h2>
              <p className="text-xs text-gray-400 mt-1">Base: ₹{Number(payModal.fixed_salary).toLocaleString('en-IN')}</p>
            </div>
            <form onSubmit={handleRunPayroll} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Month</label>
                  <select className="input-field" value={payMonth} onChange={(e) => setPayMonth(Number(e.target.value))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Year</label>
                  <input type="number" className="input-field" value={payYear} onChange={(e) => setPayYear(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="label">Bonus (₹)</label>
                <input type="number" step="any" className="input-field" value={bonus} onChange={(e) => setBonus(e.target.value)} />
              </div>
              <div>
                <label className="label">Deduction (₹)</label>
                <input type="number" step="any" className="input-field" value={deduction} onChange={(e) => setDeduction(e.target.value)} />
              </div>
              <div>
                <label className="label">Advance Recovered (₹)</label>
                <input type="number" step="any" className="input-field" value={advance} onChange={(e) => setAdvance(e.target.value)} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <p className="text-lg font-semibold text-titan-dark">Net Pay: ₹{netPay.toLocaleString('en-IN')}</p>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Mark as Paid</button>
                <button type="button" onClick={() => setPayModal(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
