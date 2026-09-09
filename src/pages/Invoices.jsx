import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const emptyLineItem = () => ({ description: '', quantity: 1, rate: 0 })

export default function Invoices() {
  const { session } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState([emptyLineItem()])

  const [payModal, setPayModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [invRes, custRes] = await Promise.all([
      supabase.from('invoices').select('*, customers(name)').order('invoice_date', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
    ])
    if (invRes.data) setInvoices(invRes.data)
    if (custRes.data) setCustomers(custRes.data)
    setLoading(false)
  }

  function updateLineItem(index, field, value) {
    setLineItems((items) => items.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  function addLineItem() {
    setLineItems((items) => [...items, emptyLineItem()])
  }

  function removeLineItem(index) {
    setLineItems((items) => items.filter((_, i) => i !== index))
  }

  const total = lineItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0)

  async function handleAddCustomer() {
    if (!newCustomer.trim()) return
    const { data, error } = await supabase.from('customers').insert({ name: newCustomer.trim() }).select().single()
    if (!error && data) {
      setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setCustomerId(data.id)
      setNewCustomer('')
      setShowNewCustomer(false)
    }
  }

  function resetForm() {
    setCustomerId(''); setInvoiceDate(new Date().toISOString().slice(0, 10)); setNotes(''); setLineItems([emptyLineItem()])
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!customerId || lineItems.length === 0) return
    setSaving(true)

    const invoiceNumber = `INV-${Date.now()}`

    const { data: invoice, error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      customer_id: customerId,
      invoice_date: invoiceDate,
      total_amount: total,
      notes: notes || null,
      created_by: session.user.id,
    }).select().single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    const itemsPayload = lineItems.map((it) => ({
      invoice_id: invoice.id,
      description: it.description,
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.rate) || 0),
    }))

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemsPayload)
    if (itemsError) {
      alert('Invoice created but items failed: ' + itemsError.message)
    } else {
      setShowModal(false)
      resetForm()
      loadAll()
    }
    setSaving(false)
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    if (!payAmount || Number(payAmount) <= 0) return
    const { error } = await supabase.from('invoice_payments').insert({
      invoice_id: payModal.id,
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

  async function handlePrintInvoice(invoice) {
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id)
    const { data: customer } = await supabase.from('customers').select('*').eq('id', invoice.customer_id).single()

    const win = window.open('', '_blank')
    win.document.write(`
      <html>
      <head>
        <title>${invoice.invoice_number}</title>
        <style>
          body { font-family: sans-serif; max-width: 700px; margin: 40px auto; color: #1A1A1A; }
          .header { text-align: center; border-bottom: 3px solid #D4A02A; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { color: #D4A02A; margin: 0; }
          .header p { color: #666; font-size: 12px; margin: 4px 0 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 14px; }
          th { background: #f4f4f4; }
          .total-row { font-weight: bold; font-size: 16px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TITAN INTERIO</h1>
          <p>Modular Kitchen & Aluminium Fabrication</p>
        </div>
        <div class="meta">
          <div><strong>Invoice #:</strong> ${invoice.invoice_number}<br/><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</div>
          <div><strong>Bill To:</strong><br/>${customer?.name || ''}<br/>${customer?.phone || ''}<br/>${customer?.address || ''}</div>
        </div>
        <table>
          <tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
          ${(items || []).map((it) => `<tr><td>${it.description}</td><td>${it.quantity}</td><td>₹${it.rate}</td><td>₹${it.amount.toLocaleString('en-IN')}</td></tr>`).join('')}
          <tr class="total-row"><td colspan="3">Total</td><td>₹${invoice.total_amount.toLocaleString('en-IN')}</td></tr>
        </table>
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
        <script>window.print()</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  const totalReceivable = invoices.reduce((sum, inv) => sum + (inv.total_amount - inv.amount_received), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Customer Invoices</h1>
          <p className="text-titan-steel text-sm">{invoices.length} invoices · Total receivable: ₹{totalReceivable.toLocaleString('en-IN')}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ New Invoice</button>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Total</th><th>Received</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs">{inv.invoice_number}</td>
                  <td className="text-xs">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                  <td className="font-medium">{inv.customers?.name || '—'}</td>
                  <td>₹{inv.total_amount.toLocaleString('en-IN')}</td>
                  <td>₹{inv.amount_received.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                      inv.status === 'partially_paid' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {inv.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="space-x-2">
                    <button onClick={() => handlePrintInvoice(inv)} className="text-titan-gold text-xs hover:underline">Print</button>
                    {inv.status !== 'paid' && (
                      <button onClick={() => setPayModal(inv)} className="text-titan-gold text-xs hover:underline">Payment</button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">No invoices yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">New Customer Invoice</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="label">Customer</label>
                {!showNewCustomer ? (
                  <div className="flex gap-2">
                    <select className="input-field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                      <option value="">Select customer</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowNewCustomer(true)} className="btn-secondary text-xs whitespace-nowrap">+ New</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input className="input-field" placeholder="New customer name" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} />
                    <button type="button" onClick={handleAddCustomer} className="btn-primary text-xs whitespace-nowrap">Add</button>
                    <button type="button" onClick={() => setShowNewCustomer(false)} className="btn-secondary text-xs">✕</button>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Invoice Date</label>
                <input type="date" className="input-field max-w-xs" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>

              <div>
                <label className="label">Line Items</label>
                <div className="space-y-2">
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input className="input-field flex-1" placeholder="Description" value={item.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} />
                      <input type="number" step="any" className="input-field w-20" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(i, 'quantity', e.target.value)} />
                      <input type="number" step="any" className="input-field w-28" placeholder="Rate" value={item.rate} onChange={(e) => updateLineItem(i, 'rate', e.target.value)} />
                      <span className="text-sm py-2 w-24 text-right">₹{((Number(item.quantity) || 0) * (Number(item.rate) || 0)).toLocaleString('en-IN')}</span>
                      {lineItems.length > 1 && (
                        <button type="button" onClick={() => removeLineItem(i)} className="text-red-500 px-1">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addLineItem} className="btn-secondary text-xs mt-2">+ Add Line Item</button>
              </div>

              <p className="text-lg font-semibold text-titan-dark text-right">Total: ₹{total.toLocaleString('en-IN')}</p>

              <div>
                <label className="label">Notes</label>
                <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Create Invoice'}</button>
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
              <h2 className="font-semibold text-titan-dark">Record Payment Received</h2>
              <p className="text-xs text-gray-400 mt-1">{payModal.customers?.name} — Balance: ₹{(payModal.total_amount - payModal.amount_received).toLocaleString('en-IN')}</p>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-3">
              <div>
                <label className="label">Amount Received *</label>
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
