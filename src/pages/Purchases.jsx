import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { compressFileIfImage } from '../lib/imageCompression'

const emptyForm = {
  supplier_id: '', bill_number: '', description: '', bill_date: new Date().toISOString().slice(0, 10),
  taxable_amount: '', cgst: '', sgst: '', igst: '', due_date: '',
}

export default function Purchases() {
  const { session } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newSupplier, setNewSupplier] = useState('')
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const [payModal, setPayModal] = useState(null) // purchase object or null
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [purchRes, supRes] = await Promise.all([
      supabase.from('purchases').select('*, suppliers(name)').order('bill_date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ])
    if (purchRes.data) setPurchases(purchRes.data)
    if (supRes.data) setSuppliers(supRes.data)
    setLoading(false)
  }

  const taxable = Number(form.taxable_amount) || 0
  const cgst = Number(form.cgst) || 0
  const sgst = Number(form.sgst) || 0
  const igst = Number(form.igst) || 0
  const total = taxable + cgst + sgst + igst

  async function handleAddSupplier() {
    if (!newSupplier.trim()) return
    const { data, error } = await supabase.from('suppliers').insert({ name: newSupplier.trim() }).select().single()
    if (!error && data) {
      setSuppliers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm((f) => ({ ...f, supplier_id: data.id }))
      setNewSupplier('')
      setShowNewSupplier(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    let invoiceFilePath = null
    if (file) {
      const compressedFile = await compressFileIfImage(file)
      const fileExt = file.name.split('.').pop()
      const filePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, compressedFile)
      if (uploadError) {
        alert('File upload failed: ' + uploadError.message)
        setSaving(false)
        return
      }
      invoiceFilePath = filePath
    }

    const { error } = await supabase.from('purchases').insert({
      supplier_id: form.supplier_id || null,
      bill_number: form.bill_number || null,
      description: form.description || null,
      bill_date: form.bill_date,
      taxable_amount: taxable,
      cgst, sgst, igst,
      total_amount: total,
      due_date: form.due_date || null,
      invoice_file_path: invoiceFilePath,
      created_by: session.user.id,
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setShowModal(false)
      setForm(emptyForm)
      setFile(null)
      loadAll()
    }
    setSaving(false)
  }

  async function handleViewInvoice(path) {
    const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('Could not open file: ' + error?.message)
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    if (!payAmount || Number(payAmount) <= 0) return
    const { error } = await supabase.from('purchase_payments').insert({
      purchase_id: payModal.id,
      amount: Number(payAmount),
      payment_mode: payMode || null,
      created_by: session.user.id,
    })
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setPayModal(null)
      setPayAmount('')
      setPayMode('')
      loadAll()
    }
  }

  const filtered = statusFilter ? purchases.filter((p) => p.status === statusFilter) : purchases
  const totalPayable = purchases.reduce((sum, p) => sum + (p.total_amount - p.amount_paid), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Purchases</h1>
          <p className="text-titan-steel text-sm">{purchases.length} bills · Total owed: ₹{totalPayable.toLocaleString('en-IN')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Add Purchase</button>
      </div>

      <div className="flex gap-3">
        <select className="input-field max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Date</th><th>Supplier</th><th>Bill #</th><th>Total</th><th>Paid</th><th>Status</th><th>Invoice</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs">{new Date(p.bill_date).toLocaleDateString()}</td>
                  <td className="font-medium">{p.suppliers?.name || '—'}</td>
                  <td className="text-xs">{p.bill_number || '—'}</td>
                  <td>₹{p.total_amount.toLocaleString('en-IN')}</td>
                  <td>₹{p.amount_paid.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      p.status === 'paid' ? 'bg-green-100 text-green-700' :
                      p.status === 'partially_paid' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {p.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {p.invoice_file_path ? (
                      <button onClick={() => handleViewInvoice(p.invoice_file_path)} className="text-titan-gold text-xs hover:underline">View</button>
                    ) : '—'}
                  </td>
                  <td>
                    {p.status !== 'paid' && (
                      <button onClick={() => setPayModal(p)} className="text-titan-gold text-xs hover:underline">Record Payment</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">No purchases found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">Add Purchase (Supplier Bill)</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="label">Supplier</label>
                {!showNewSupplier ? (
                  <div className="flex gap-2">
                    <select className="input-field" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                      <option value="">Select supplier</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowNewSupplier(true)} className="btn-secondary text-xs whitespace-nowrap">+ New</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input className="input-field" placeholder="New supplier name" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />
                    <button type="button" onClick={handleAddSupplier} className="btn-primary text-xs whitespace-nowrap">Add</button>
                    <button type="button" onClick={() => setShowNewSupplier(false)} className="btn-secondary text-xs">✕</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Bill Number</label>
                  <input className="input-field" value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} />
                </div>
                <div>
                  <label className="label">Bill Date</label>
                  <input type="date" className="input-field" value={form.bill_date} onChange={(e) => setForm({ ...form, bill_date: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Aluminium profiles, 6063 grade" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label">Taxable Amt</label>
                  <input type="number" step="any" className="input-field" value={form.taxable_amount} onChange={(e) => setForm({ ...form, taxable_amount: e.target.value })} />
                </div>
                <div>
                  <label className="label">CGST</label>
                  <input type="number" step="any" className="input-field" value={form.cgst} onChange={(e) => setForm({ ...form, cgst: e.target.value })} />
                </div>
                <div>
                  <label className="label">SGST</label>
                  <input type="number" step="any" className="input-field" value={form.sgst} onChange={(e) => setForm({ ...form, sgst: e.target.value })} />
                </div>
                <div>
                  <label className="label">IGST</label>
                  <input type="number" step="any" className="input-field" value={form.igst} onChange={(e) => setForm({ ...form, igst: e.target.value })} />
                </div>
              </div>

              <p className="text-sm font-semibold text-titan-dark">Total: ₹{total.toLocaleString('en-IN')}</p>

              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input-field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>

              <div>
                <label className="label">Upload Invoice (PDF or photo)</label>
                <input type="file" accept=".pdf,image/*" className="input-field" onChange={(e) => setFile(e.target.files[0])} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Purchase'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">Record Payment</h2>
              <p className="text-xs text-gray-400 mt-1">{payModal.suppliers?.name} — Balance: ₹{(payModal.total_amount - payModal.amount_paid).toLocaleString('en-IN')}</p>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-3">
              <div>
                <label className="label">Amount Paid *</label>
                <input required type="number" step="any" className="input-field" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <input className="input-field" value={payMode} onChange={(e) => setPayMode(e.target.value)} placeholder="Cash, UPI, Bank Transfer..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Record</button>
                <button type="button" onClick={() => setPayModal(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
