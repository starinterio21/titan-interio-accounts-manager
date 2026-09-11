import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CategoryPicker from '../components/CategoryPicker'

const emptyForm = {
  id: null, sku: '', name: '', category_id: '', sub_category: '', unit: 'PCS',
  dimensions: '', reorder_level: 0, cost_price: 0, selling_price: 0,
  supplier_id: '', location: '', notes: '',
}

export default function Inventory() {
  const { isManager } = useAuth()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [newCategory, setNewCategory] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [itemsRes, catRes, supRes] = await Promise.all([
      supabase.from('items').select('*, categories(name), suppliers(name)').eq('active', true).order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ])
    if (itemsRes.data) setItems(itemsRes.data)
    if (catRes.data) setCategories(catRes.data)
    if (supRes.data) setSuppliers(supRes.data)
    setLoading(false)
  }

  function openAddModal() {
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEditModal(item) {
    setForm({
      id: item.id, sku: item.sku, name: item.name, category_id: item.category_id || '',
      sub_category: item.sub_category || '', unit: item.unit, dimensions: item.dimensions || '',
      reorder_level: item.reorder_level, cost_price: item.cost_price, selling_price: item.selling_price,
      supplier_id: item.supplier_id || '', location: item.location || '', notes: item.notes || '',
    })
    setShowModal(true)
  }

  async function handleAddCategory() {
    if (!newCategory.trim()) return
    const { data, error } = await supabase.from('categories').insert({ name: newCategory.trim() }).select().single()
    if (!error && data) {
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm((f) => ({ ...f, category_id: data.id }))
      setNewCategory('')
      setShowNewCategory(false)
    }
  }

  async function handleDeleteCategory() {
    if (!form.category_id) return
    const category = categories.find((c) => c.id === form.category_id)
    if (!category) return

    const { count } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', form.category_id)

    const usageWarning = count > 0
      ? `${count} item${count !== 1 ? 's' : ''} currently use "${category.name}" — they'll become uncategorized. `
      : ''
    if (!confirm(`${usageWarning}Delete category "${category.name}"? This cannot be undone.`)) return

    const { error } = await supabase.from('categories').delete().eq('id', form.category_id)
    if (error) {
      alert('Error deleting category: ' + error.message)
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== form.category_id))
      setForm((f) => ({ ...f, category_id: '' }))
      loadAll()
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      sku: form.sku, name: form.name, category_id: form.category_id || null,
      sub_category: form.sub_category || null, unit: form.unit, dimensions: form.dimensions || null,
      reorder_level: Number(form.reorder_level), cost_price: Number(form.cost_price),
      selling_price: Number(form.selling_price), supplier_id: form.supplier_id || null,
      location: form.location || null, notes: form.notes || null,
    }

    let error
    if (form.id) {
      ;({ error } = await supabase.from('items').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('items').insert({ ...payload, opening_stock: 0, current_stock: null }))
    }

    if (error) {
      alert('Error saving item: ' + error.message)
    } else {
      setShowModal(false)
      loadAll()
    }
    setSaving(false)
  }

  async function handleDeactivate(item) {
    if (!confirm(`Deactivate "${item.name}"? It will be hidden from active inventory but transaction history is preserved.`)) return
    await supabase.from('items').update({ active: false }).eq('id', item.id)
    loadAll()
  }

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryFilter || item.category_id === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-titan-dark">Inventory</h1>
          <p className="text-titan-steel text-sm">{items.length} active items</p>
        </div>
        {isManager && (
          <button onClick={openAddModal} className="btn-primary">+ Add Item</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="input-field max-w-xs"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="w-full max-w-xs">
          <CategoryPicker
            categories={categories}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Search category to filter..."
            allowAll
            withIds
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Reorder Lvl</th>
                <th>Cost</th>
                <th>Location</th>
                {isManager && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isNotCounted = item.current_stock === null
                const isOutOfStock = item.current_stock !== null && item.current_stock <= 0
                const isLowStock = item.current_stock !== null && item.current_stock > 0 && item.current_stock <= item.reorder_level
                return (
                <tr key={item.id} className={isOutOfStock ? 'bg-red-50' : isLowStock ? 'bg-orange-50' : ''}>
                  <td className="font-mono text-xs">{item.sku}</td>
                  <td className="font-medium">{item.name}</td>
                  <td>{item.categories?.name || '—'}</td>
                  <td className={isOutOfStock ? 'text-red-600 font-semibold' : isLowStock ? 'text-orange-600 font-semibold' : isNotCounted ? 'text-gray-400 italic' : ''}>
                    {isNotCounted ? 'Not counted' : `${item.current_stock} ${item.unit}`}
                  </td>
                  <td>{item.reorder_level}</td>
                  <td>₹{item.cost_price}</td>
                  <td>{item.location || '—'}</td>
                  {isManager && (
                    <td>
                      <button onClick={() => openEditModal(item)} className="text-titan-gold text-xs hover:underline mr-3">Edit</button>
                      <button onClick={() => handleDeactivate(item)} className="text-red-500 text-xs hover:underline">Deactivate</button>
                    </td>
                  )}
                </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">No items found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-titan-dark">{form.id ? 'Edit Item' : 'Add New Item'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">SKU / Item Code *</label>
                  <input required className="input-field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <input className="input-field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="PCS, KG, MTR..." />
                </div>
              </div>

              <div>
                <label className="label">Item Name *</label>
                <input required className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <label className="label">Category</label>
                {!showNewCategory ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <CategoryPicker
                        categories={categories}
                        value={form.category_id}
                        onChange={(v) => setForm({ ...form, category_id: v })}
                        placeholder="Search category..."
                        allowAll
                        withIds
                      />
                    </div>
                    <button type="button" onClick={() => setShowNewCategory(true)} className="btn-secondary text-xs whitespace-nowrap">+ New</button>
                    <button
                      type="button"
                      onClick={handleDeleteCategory}
                      disabled={!form.category_id}
                      className="btn-secondary text-xs whitespace-nowrap text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input className="input-field" placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                    <button type="button" onClick={handleAddCategory} className="btn-primary text-xs whitespace-nowrap">Add</button>
                    <button type="button" onClick={() => setShowNewCategory(false)} className="btn-secondary text-xs">✕</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Sub-Category / Variant</label>
                  <input className="input-field" value={form.sub_category} onChange={(e) => setForm({ ...form, sub_category: e.target.value })} />
                </div>
                <div>
                  <label className="label">Dimensions</label>
                  <input className="input-field" value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Reorder Level</label>
                  <input type="number" step="any" className="input-field" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cost Price (₹)</label>
                  <input type="number" step="any" className="input-field" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div>
                  <label className="label">Selling Price (₹)</label>
                  <input type="number" step="any" className="input-field" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="label">Supplier</label>
                <select className="input-field" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">No supplier yet? Add one from the Suppliers page.</p>
              </div>

              <div>
                <label className="label">Storage Location</label>
                <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Rack A-3, Shelf 2..." />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              {!form.id && (
                <p className="text-xs text-titan-steel bg-titan-gold/10 border border-titan-gold/30 rounded-md p-2">
                  New items start with 0 stock. Use "Stock In" after saving to record the opening quantity.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Item'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
