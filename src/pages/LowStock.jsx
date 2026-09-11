import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LowStock() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLowStock()
  }, [])

  async function loadLowStock() {
    setLoading(true)
    const { data } = await supabase
      .from('items')
      .select('*, categories(name)')
      .eq('active', true)
      .order('name', { ascending: true })

    // Low Stock: above 0, but at or below reorder level (excludes not-yet-counted items)
    const lowStock = (data || []).filter(
      (i) => i.current_stock !== null && i.current_stock > 0 && i.reorder_level !== null && i.current_stock <= i.reorder_level
    )
    setItems(lowStock)
    setLoading(false)
  }

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of filtered) {
      const cat = item.categories?.name || 'Uncategorized'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(item)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-titan-dark">Low Stock Items</h1>
        <p className="text-titan-steel text-sm">
          {items.length} item{items.length !== 1 ? 's' : ''} across {grouped.length} categor{grouped.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      <input
        className="input-field max-w-xs"
        placeholder="Search by name or SKU..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-titan-steel">Loading...</p>
      ) : grouped.length === 0 ? (
        <div className="card">
          <p className="text-sm text-gray-400 py-4">No low stock items 🎉</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
          {grouped.map(([category, catItems]) => (
            <div key={category} className="card p-3 mb-3 break-inside-avoid">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</span>
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {catItems.length} low
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {catItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="min-w-0 pr-2 overflow-x-auto">
                      <p className="font-medium text-titan-dark whitespace-nowrap">{item.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                    </div>
                    <span className="text-orange-600 font-semibold whitespace-nowrap">
                      {item.current_stock} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
