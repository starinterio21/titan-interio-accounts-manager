import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const emptyLineItem = () => ({ description: '', quantity: 1, rate: 0 })

export default function Quotations() {
  const { session } = useAuth()
  const [quotations, setQuotations] = useState([])
  const [customers, setCustomers] = useState([])
  const [catalog, setCatalog] = useState([])
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState('')
  const [gstEnabled, setGstEnabled] = useState(false)
  const [lineItems, setLineItems] = useState([emptyLineItem()])

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [qRes, custRes, catRes, bizRes] = await Promise.all([
      supabase.from('quotations').select('*, customers(name, phone)').order('quotation_date', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
      supabase.from('items_catalog').select('*').eq('active', true).order('name'),
      supabase.from('business_settings').select('*').single(),
    ])
    if (qRes.data) setQuotations(qRes.data)
    if (custRes.data) setCustomers(custRes.data)
    if (catRes.data) setCatalog(catRes.data)
    if (bizRes.data) setBusiness(bizRes.data)
    setLoading(false)
  }

  function updateLineItem(index, field, value) {
    setLineItems((items) => items.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  function pickFromCatalog(index, catalogId) {
    const item = catalog.find((c) => c.id === catalogId)
    if (!item) return
    setLineItems((items) => items.map((it, i) => (i === index ? { ...it, description: item.name, rate: item.default_rate } : it)))
  }

  function addLineItem() { setLineItems((items) => [...items, emptyLineItem()]) }
  function removeLineItem(index) { setLineItems((items) => items.filter((_, i) => i !== index)) }

  const subtotal = lineItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0)
  const discountAmt = Number(discount) || 0
  const afterDiscount = Math.max(subtotal - discountAmt, 0)
  const cgst = gstEnabled ? afterDiscount * 0.09 : 0
  const sgst = gstEnabled ? afterDiscount * 0.09 : 0
  const total = afterDiscount + cgst + sgst

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
    setCustomerId(''); setQuoteDate(new Date().toISOString().slice(0, 10)); setNotes('')
    setDiscount(''); setGstEnabled(false); setLineItems([emptyLineItem()])
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!customerId || lineItems.length === 0) return
    setSaving(true)

    const quotationNumber = `QUO-${Date.now()}`

    const { data: quotation, error } = await supabase.from('quotations').insert({
      quotation_number: quotationNumber,
      customer_id: customerId,
      quotation_date: quoteDate,
      discount: discountAmt,
      gst_enabled: gstEnabled,
      cgst, sgst,
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
      quotation_id: quotation.id,
      description: it.description,
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.rate) || 0),
    }))

    await supabase.from('quotation_items').insert(itemsPayload)
    setShowModal(false)
    resetForm()
    loadAll()
    setSaving(false)
  }

  async function handleConvertToInvoice(quotation) {
    if (!confirm(`Convert ${quotation.quotation_number} into a customer invoice?`)) return

    const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotation.id)

    const invoiceNumber = `INV-${Date.now()}`
    const { data: invoice, error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      customer_id: quotation.customer_id,
      invoice_date: new Date().toISOString().slice(0, 10),
      discount: quotation.discount,
      gst_enabled: quotation.gst_enabled,
      cgst: quotation.cgst,
      sgst: quotation.sgst,
      total_amount: quotation.total_amount,
      notes: quotation.notes,
      terms: business?.terms_and_conditions || null,
      created_by: session.user.id,
    }).select().single()

    if (error) {
      alert('Error creating invoice: ' + error.message)
      return
    }

    const itemsPayload = (items || []).map((it) => ({
      invoice_id: invoice.id,
      description: it.description,
      quantity: it.quantity,
      rate: it.rate,
      amount: it.amount,
    }))
    await supabase.from('invoice_items').insert(itemsPayload)

    await supabase.from('quotations').update({ status: 'converted', converted_invoice_id: invoice.id }).eq('id', quotation.id)

    alert(`Converted to invoice ${invoiceNumber} — find it in Customer Invoices.`)
    loadAll()
  }

  function handlePrintQuotation(quotation, items, customer) {
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>${quotation.quotation_number}</title>
      <style>
        body { font-family: sans-serif; max-width: 700px; margin: 40px auto; color: #1A1A1A; }
        .header { text-align: center; border-bottom: 3px solid #D4A02A; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { color: #D4A02A; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 14px; }
        th { background: #f4f4f4; }
      </style></head>
      <body>
        <div class="header"><h1>${business?.business_name || 'TITAN INTERIO'}</h1><p>QUOTATION</p></div>
        <p><strong>Quote #:</strong> ${quotation.quotation_number} · <strong>Date:</strong> ${new Date(quotation.quotation_date).toLocaleDateString()}</p>
        <p><strong>To:</strong> ${customer?.name || ''} ${customer?.phone || ''}</p>
        <table>
          <tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
          ${(items || []).map((it) => `<tr><td>${it.description}</td><td>${it.quantity}</td><td>₹${it.rate}</td><td>₹${it.amount.toLocaleString('en-IN')}</td></tr>`).join('')}
          <tr><td colspan="3"><strong>Total</strong></td><td><strong>₹${quotation.total_amount.toLocaleString('en-IN')}</strong></td></tr>
        </table>
        <script>window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  async function handlePrint(q) {
    const { data: items } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id)
    const { data: customer } = await supabase.from('customers').select('*').eq('id', q.customer_id).single()
    handlePrintQuotation(q, items, customer)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Quotations</h1>
          <p className="text-titan-steel text-sm">{quotations.length} quotations</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ New Quotation</button>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr><th>Quote #</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td className="font-mono text-xs">{q.quotation_number}</td>
                  <td className="text-xs">{new Date(q.quotation_date).toLocaleDateString()}</td>
                  <td className="font-medium">{q.customers?.name || '—'}</td>
                  <td>₹{q.total_amount.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${q.status === 'converted' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {q.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button onClick={() => handlePrint(q)} className="text-titan-gold text-xs hover:underline">Print</button>
                    {q.status === 'open' && (
                      <button onClick={() => handleConvertToInvoice(q)} className="text-green-600 text-xs hover:underline">Convert to Invoice</button>
                    )}
                  </td>
                </tr>
              ))}
              {quotations.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No quotations yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200"><h2 className="font-semibold text-titan-dark">New Quotation</h2></div>
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
                <label className="label">Quotation Date</label>
                <input type="date" className="input-field max-w-xs" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
              </div>

              <div>
                <label className="label">Line Items</label>
                <div className="space-y-2">
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start flex-wrap">
                      {catalog.length > 0 && (
                        <select className="input-field w-32" onChange={(e) => pickFromCatalog(i, e.target.value)} defaultValue="">
                          <option value="" disabled>From catalog</option>
                          {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      <input className="input-field flex-1 min-w-[140px]" placeholder="Description" value={item.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} />
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Discount (₹)</label>
                  <input type="number" step="any" className="input-field" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} />
                    Apply GST (9% + 9%)
                  </label>
                </div>
              </div>

              <p className="text-lg font-semibold text-titan-dark text-right">Total: ₹{total.toLocaleString('en-IN')}</p>

              <div>
                <label className="label">Notes</label>
                <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Create Quotation'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
