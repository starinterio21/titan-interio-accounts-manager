import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const emptyLineItem = () => ({ description: '', quantity: 1, unit: 'PCS' })

export default function DeliveryChallans() {
  const { session } = useAuth()
  const [challans, setChallans] = useState([])
  const [customers, setCustomers] = useState([])
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [challanDate, setChallanDate] = useState(new Date().toISOString().slice(0, 10))
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState([emptyLineItem()])

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [chRes, custRes, bizRes] = await Promise.all([
      supabase.from('delivery_challans').select('*, customers(name, phone)').order('challan_date', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
      supabase.from('business_settings').select('*').single(),
    ])
    if (chRes.data) setChallans(chRes.data)
    if (custRes.data) setCustomers(custRes.data)
    if (bizRes.data) setBusiness(bizRes.data)
    setLoading(false)
  }

  function updateLineItem(index, field, value) {
    setLineItems((items) => items.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }
  function addLineItem() { setLineItems((items) => [...items, emptyLineItem()]) }
  function removeLineItem(index) { setLineItems((items) => items.filter((_, i) => i !== index)) }

  function resetForm() {
    setCustomerId(''); setChallanDate(new Date().toISOString().slice(0, 10))
    setVehicleNumber(''); setNotes(''); setLineItems([emptyLineItem()])
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!customerId) return
    setSaving(true)

    const challanNumber = `DC-${Date.now()}`
    const { data: challan, error } = await supabase.from('delivery_challans').insert({
      challan_number: challanNumber,
      customer_id: customerId,
      challan_date: challanDate,
      vehicle_number: vehicleNumber || null,
      notes: notes || null,
      created_by: session.user.id,
    }).select().single()

    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }

    const itemsPayload = lineItems.map((it) => ({
      challan_id: challan.id, description: it.description, quantity: Number(it.quantity) || 0, unit: it.unit,
    }))
    await supabase.from('challan_items').insert(itemsPayload)

    setShowModal(false)
    resetForm()
    loadAll()
    setSaving(false)
  }

  async function handlePrint(challan) {
    const { data: items } = await supabase.from('challan_items').select('*').eq('challan_id', challan.id)
    const { data: customer } = await supabase.from('customers').select('*').eq('id', challan.customer_id).single()

    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>${challan.challan_number}</title>
      <style>
        body { font-family: sans-serif; max-width: 700px; margin: 40px auto; color: #1A1A1A; }
        .header { text-align: center; border-bottom: 3px solid #D4A02A; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { color: #D4A02A; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 14px; }
        th { background: #f4f4f4; }
      </style></head>
      <body>
        <div class="header"><h1>${business?.business_name || 'TITAN INTERIO'}</h1><p>DELIVERY CHALLAN</p></div>
        <p><strong>Challan #:</strong> ${challan.challan_number} · <strong>Date:</strong> ${new Date(challan.challan_date).toLocaleDateString()}</p>
        <p><strong>To:</strong> ${customer?.name || ''} ${customer?.phone || ''}</p>
        ${challan.vehicle_number ? `<p><strong>Vehicle:</strong> ${challan.vehicle_number}</p>` : ''}
        <table>
          <tr><th>Description</th><th>Quantity</th><th>Unit</th></tr>
          ${(items || []).map((it) => `<tr><td>${it.description}</td><td>${it.quantity}</td><td>${it.unit}</td></tr>`).join('')}
        </table>
        ${challan.notes ? `<p><strong>Notes:</strong> ${challan.notes}</p>` : ''}
        <p style="margin-top:60px;">Received in good condition: ______________________</p>
        <script>window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Delivery Challans</h1>
          <p className="text-titan-steel text-sm">{challans.length} challans</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ New Challan</button>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead><tr><th>Challan #</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Actions</th></tr></thead>
            <tbody>
              {challans.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.challan_number}</td>
                  <td className="text-xs">{new Date(c.challan_date).toLocaleDateString()}</td>
                  <td className="font-medium">{c.customers?.name || '—'}</td>
                  <td>{c.vehicle_number || '—'}</td>
                  <td><button onClick={() => handlePrint(c)} className="text-titan-gold text-xs hover:underline">Print</button></td>
                </tr>
              ))}
              {challans.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">No delivery challans yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200"><h2 className="font-semibold text-titan-dark">New Delivery Challan</h2></div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="label">Customer *</label>
                <select required className="input-field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input-field" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Vehicle Number</label>
                  <input className="input-field" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Items</label>
                <div className="space-y-2">
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input className="input-field flex-1" placeholder="Description" value={item.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} />
                      <input type="number" step="any" className="input-field w-20" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(i, 'quantity', e.target.value)} />
                      <input className="input-field w-20" placeholder="Unit" value={item.unit} onChange={(e) => updateLineItem(i, 'unit', e.target.value)} />
                      {lineItems.length > 1 && <button type="button" onClick={() => removeLineItem(i)} className="text-red-500 px-1">✕</button>}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addLineItem} className="btn-secondary text-xs mt-2">+ Add Item</button>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Create Challan'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
