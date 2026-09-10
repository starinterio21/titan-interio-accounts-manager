import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { compressFileIfImage } from '../lib/imageCompression'

const CATEGORIES = ['Travel / Site Visit', 'Snacks / Food', 'Courier', 'Fuel', 'Office Supplies', 'Repairs', 'Miscellaneous']

const emptyForm = {
  expense_date: new Date().toISOString().slice(0, 10), category: 'Miscellaneous',
  amount: '', description: '', paid_by: '',
}

export default function Expenses() {
  const { session, profile } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM

  useEffect(() => {
    loadExpenses()
  }, [])

  async function loadExpenses() {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    if (data) setExpenses(data)
    setLoading(false)
  }

  function openAdd() {
    setForm({ ...emptyForm, paid_by: profile?.full_name || '' })
    setFile(null)
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    let receiptPath = null
    if (file) {
      const compressedFile = await compressFileIfImage(file)
      const fileExt = file.name.split('.').pop()
      const filePath = `receipts/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, compressedFile)
      if (uploadError) {
        alert('Receipt upload failed: ' + uploadError.message)
        setSaving(false)
        return
      }
      receiptPath = filePath
    }

    const { error } = await supabase.from('expenses').insert({
      expense_date: form.expense_date,
      category: form.category,
      amount: Number(form.amount) || 0,
      description: form.description || null,
      paid_by: form.paid_by || null,
      receipt_file_path: receiptPath,
      created_by: session.user.id,
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setShowModal(false)
      loadExpenses()
    }
    setSaving(false)
  }

  async function handleDelete(exp) {
    if (!confirm('Delete this expense entry?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', exp.id)
    if (error) alert('Error: ' + error.message)
    else loadExpenses()
  }

  async function handleViewReceipt(path) {
    const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('Could not open file: ' + error?.message)
  }

  const filtered = expenses.filter((e) => {
    const matchesCategory = !categoryFilter || e.category === categoryFilter
    const matchesMonth = !monthFilter || e.expense_date.startsWith(monthFilter)
    return matchesCategory && matchesMonth
  })

  const totalFiltered = filtered.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Expenses</h1>
          <p className="text-titan-steel text-sm">{filtered.length} entries · Total: ₹{totalFiltered.toLocaleString('en-IN')}</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Expense</button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input type="month" className="input-field max-w-xs" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
        <select className="input-field max-w-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Paid By</th><th>Receipt</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((exp) => (
                <tr key={exp.id}>
                  <td className="text-xs">{new Date(exp.expense_date).toLocaleDateString()}</td>
                  <td><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{exp.category}</span></td>
                  <td>{exp.description || '—'}</td>
                  <td className="font-semibold">₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                  <td className="text-xs">{exp.paid_by || '—'}</td>
                  <td>
                    {exp.receipt_file_path ? (
                      <button onClick={() => handleViewReceipt(exp.receipt_file_path)} className="text-titan-gold text-xs hover:underline">View</button>
                    ) : '—'}
                  </td>
                  <td>
                    <button onClick={() => handleDelete(exp)} className="text-red-500 text-xs hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">No expenses found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">Add Expense</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input-field" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount (₹) *</label>
                <input required type="number" step="any" className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Site visit to customer's home" />
              </div>
              <div>
                <label className="label">Paid By</label>
                <input className="input-field" value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })} />
              </div>
              <div>
                <label className="label">Receipt (optional)</label>
                <input type="file" accept=".pdf,image/*" className="input-field" onChange={(e) => setFile(e.target.files[0])} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Expense'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
