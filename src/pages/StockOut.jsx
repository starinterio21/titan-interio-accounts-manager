import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ItemPicker from '../components/ItemPicker'

export default function StockOut() {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [jobOrder, setJobOrder] = useState('')
  const [issuedTo, setIssuedTo] = useState('')
  const [jobSuggestions, setJobSuggestions] = useState([])
  const [jobUnknown, setJobUnknown] = useState(false)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadItems()
    loadJobSuggestions()
  }, [])

  async function loadJobSuggestions() {
    const { data } = await supabase
      .from('stock_transactions')
      .select('job_order')
      .not('job_order', 'is', null)
      .neq('job_order', '')
    if (data) {
      const unique = Array.from(new Set(data.map((d) => d.job_order.trim()))).sort((a, b) => a.localeCompare(b))
      setJobSuggestions(unique)
    }
  }

  async function loadItems() {
    const { data } = await supabase
      .from('items')
      .select('id, sku, name, unit, current_stock, categories(name)')
      .eq('active', true)
      .order('name')
    if (data) setItems(data)
  }

  const selectedItem = items.find((i) => i.id === itemId)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!itemId || !quantity || Number(quantity) <= 0) return
    const effectiveJobOrder = jobUnknown ? 'Unknown' : jobOrder.trim()
    if (!effectiveJobOrder) {
      setMessage('Job / Work Order Reference is required')
      return
    }

    if (selectedItem && selectedItem.current_stock !== null && Number(quantity) > selectedItem.current_stock) {
      const proceed = confirm(
        `Warning: this will take stock below zero (current: ${selectedItem.current_stock} ${selectedItem.unit}). Continue anyway?`
      )
      if (!proceed) return
    }

    setSaving(true)
    setMessage('')

    const now = new Date()
    const [year, month, day] = entryDate.split('-').map(Number)
    const createdAt = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())

    const { error } = await supabase.from('stock_transactions').insert({
      item_id: itemId,
      type: 'out',
      quantity: Number(quantity),
      job_order: effectiveJobOrder,
      issued_to: issuedTo || null,
      user_id: session.user.id,
      created_at: createdAt.toISOString(),
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('✅ Stock out recorded successfully')
      // Job name stays filled in on purpose — issuing multiple items to the
      // same job in a row is the common case, so don't make them retype it.
      setItemId(''); setQuantity(''); setIssuedTo('')
      setEntryDate(new Date().toISOString().slice(0, 10))
      loadItems()
      loadJobSuggestions()
    }
    setSaving(false)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-titan-dark">Stock Out</h1>
        <p className="text-titan-steel text-sm">Record material issued to production or a job</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Item *</label>
          <ItemPicker items={items} value={itemId} onChange={setItemId} />
          {selectedItem && (
            <p className="text-xs text-gray-400 mt-1">
              Current stock: {selectedItem.current_stock === null ? 'Not counted' : `${selectedItem.current_stock} ${selectedItem.unit}`}
            </p>
          )}
        </div>

        <div>
          <label className="label">Quantity Issued *</label>
          <input required type="number" step="any" min="0.01" className="input-field" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>

        <div>
          <label className="label">Date Issued</label>
          <input
            type="date"
            className="input-field"
            value={entryDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setEntryDate(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Defaults to today — change this for backdated / historical entries.</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label">Job / Work Order Reference {!jobUnknown && '*'}</label>
            {(jobOrder || jobUnknown) && (
              <button
                type="button"
                onClick={() => { setJobOrder(''); setJobUnknown(false) }}
                className="text-xs text-titan-gold hover:underline"
              >
                Clear (start new job)
              </button>
            )}
          </div>
          <input
            required={!jobUnknown}
            disabled={jobUnknown}
            className="input-field disabled:bg-gray-100 disabled:text-gray-400"
            list="job-order-suggestions"
            value={jobUnknown ? 'Unknown' : jobOrder}
            onChange={(e) => setJobOrder(e.target.value)}
            placeholder="JOB-2026-014"
            autoComplete="off"
          />
          <datalist id="job-order-suggestions">
            {jobSuggestions.map((job) => (
              <option key={job} value={job} />
            ))}
          </datalist>
          {!jobUnknown && jobOrder.trim() && jobSuggestions.some((j) => j.toLowerCase() === jobOrder.trim().toLowerCase()) && (
            <p className="text-xs text-titan-gold mt-1">Adding to existing project "{jobOrder.trim()}"</p>
          )}
          <label className="flex items-center gap-2 mt-2 text-sm text-titan-steel">
            <input
              type="checkbox"
              checked={jobUnknown}
              onChange={(e) => setJobUnknown(e.target.checked)}
            />
            Job unknown (historical entry)
          </label>
        </div>

        <div>
          <label className="label">Issued To</label>
          <input className="input-field" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Staff / team name" />
        </div>

        {message && <p className={message.startsWith('✅') ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>{message}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Recording...' : 'Record Stock Out'}
        </button>
      </form>
    </div>
  )
}
