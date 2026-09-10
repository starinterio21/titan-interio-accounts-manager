import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const emptyForm = { id: null, name: '', default_rate: '', unit: 'PCS' }

export default function ItemMaster() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase.from('items_catalog').select('*').eq('active', true).order('name')
    if (data) setItems(data)
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(item) {
    setForm({ id: item.id, name: item.name, default_rate: item.default_rate, unit: item.unit })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    const payload = { name: form.name, default_rate: Number(form.default_rate) || 0, unit: form.unit }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('items_catalog').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('items_catalog').insert(payload))
    }
    if (error) alert('Error: ' + error.message)
    else {
      setShowModal(false)
      loadItems()
    }
  }

  async function handleRemove(item) {
    if (!confirm(`Remove "${item.name}" from the catalog?`)) return
    await supabase.from('items_catalog').update({ active: false }).eq('id', item.id)
    loadItems()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Item / Service Catalog</h1>
          <p className="text-titan-steel text-sm">Save items once, pick them quickly on invoices & quotations</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Item</button>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr><th>Name</th><th>Default Rate</th><th>Unit</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.name}</td>
                  <td>₹{Number(item.default_rate).toLocaleString('en-IN')}</td>
                  <td>{item.unit}</td>
                  <td className="space-x-2">
                    <button onClick={() => openEdit(item)} className="text-titan-gold text-xs hover:underline">Edit</button>
                    <button onClick={() => handleRemove(item)} className="text-red-500 text-xs hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray-400 py-8">No items in catalog yet — add your commonly billed items/services here</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">{form.id ? 'Edit Item' : 'Add Item'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="label">Name *</label>
                <input required className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Modular Kitchen Cabinet - per sq ft" />
              </div>
              <div>
                <label className="label">Default Rate (₹)</label>
                <input type="number" step="any" className="input-field" value={form.default_rate} onChange={(e) => setForm({ ...form, default_rate: e.target.value })} />
              </div>
              <div>
                <label className="label">Unit</label>
                <input className="input-field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="PCS, Sq.ft, Set..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Save</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
