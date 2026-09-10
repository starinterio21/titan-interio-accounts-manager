import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const emptyForm = { note_type: 'credit', invoice_id: '', customer_id: '', note_date: new Date().toISOString().slice(0, 10), amount: '', reason: '' }

export default function CreditDebitNotes() {
  const { session } = useAuth()
  const [notes, setNotes] = useState([])
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [notesRes, invRes, custRes] = await Promise.all([
      supabase.from('credit_debit_notes').select('*, customers(name), invoices(invoice_number)').order('note_date', { ascending: false }),
      supabase.from('invoices').select('id, invoice_number, customer_id').order('invoice_date', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
    ])
    if (notesRes.data) setNotes(notesRes.data)
    if (invRes.data) setInvoices(invRes.data)
    if (custRes.data) setCustomers(custRes.data)
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const noteNumber = `${form.note_type === 'credit' ? 'CN' : 'DN'}-${Date.now()}`
    const { error } = await supabase.from('credit_debit_notes').insert({
      note_number: noteNumber,
      note_type: form.note_type,
      invoice_id: form.invoice_id || null,
      customer_id: form.customer_id || null,
      note_date: form.note_date,
      amount: Number(form.amount) || 0,
      reason: form.reason || null,
      created_by: session.user.id,
    })
    if (error) alert('Error: ' + error.message)
    else {
      setShowModal(false)
      loadAll()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Credit / Debit Notes</h1>
          <p className="text-titan-steel text-sm">{notes.length} notes — for returns, corrections, adjustments</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Note</button>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead><tr><th>Note #</th><th>Type</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Amount</th><th>Reason</th></tr></thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id}>
                  <td className="font-mono text-xs">{n.note_number}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${n.note_type === 'credit' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {n.note_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-xs">{new Date(n.note_date).toLocaleDateString()}</td>
                  <td>{n.customers?.name || '—'}</td>
                  <td className="text-xs">{n.invoices?.invoice_number || '—'}</td>
                  <td className="font-semibold">₹{Number(n.amount).toLocaleString('en-IN')}</td>
                  <td className="text-xs">{n.reason || '—'}</td>
                </tr>
              ))}
              {notes.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">No credit/debit notes yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200"><h2 className="font-semibold text-titan-dark">Add Credit/Debit Note</h2></div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="label">Type</label>
                <select className="input-field" value={form.note_type} onChange={(e) => setForm({ ...form, note_type: e.target.value })}>
                  <option value="credit">Credit Note (reduces what customer owes)</option>
                  <option value="debit">Debit Note (increases what customer owes)</option>
                </select>
              </div>
              <div>
                <label className="label">Customer</label>
                <select className="input-field" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Against Invoice (optional)</label>
                <select className="input-field" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}>
                  <option value="">None</option>
                  {invoices.filter((i) => !form.customer_id || i.customer_id === form.customer_id).map((i) => (
                    <option key={i.id} value={i.id}>{i.invoice_number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input-field" value={form.note_date} onChange={(e) => setForm({ ...form, note_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Amount (₹) *</label>
                <input required type="number" step="any" className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Reason</label>
                <input className="input-field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Damaged goods returned" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
