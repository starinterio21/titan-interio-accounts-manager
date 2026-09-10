import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PartyLedger() {
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    const { data } = await supabase.from('customers').select('*').order('name')
    if (data) setCustomers(data)
  }

  useEffect(() => {
    if (customerId) loadLedger(customerId)
    else setLedgerEntries([])
  }, [customerId])

  async function loadLedger(custId) {
    setLoading(true)
    const [invRes, payRes, notesRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('customer_id', custId),
      supabase.from('invoice_payments').select('*, invoices!inner(customer_id, invoice_number)').eq('invoices.customer_id', custId),
      supabase.from('credit_debit_notes').select('*').eq('customer_id', custId),
    ])

    const entries = []
    ;(invRes.data || []).forEach((inv) => {
      entries.push({
        date: inv.invoice_date, type: 'Invoice', ref: inv.invoice_number,
        debit: inv.total_amount, credit: 0,
      })
    })
    ;(payRes.data || []).forEach((pay) => {
      entries.push({
        date: pay.payment_date, type: 'Payment Received', ref: pay.invoices?.invoice_number || '',
        debit: 0, credit: pay.amount,
      })
    })
    ;(notesRes.data || []).forEach((note) => {
      entries.push({
        date: note.note_date, type: note.note_type === 'credit' ? 'Credit Note' : 'Debit Note',
        ref: note.note_number,
        debit: note.note_type === 'debit' ? note.amount : 0,
        credit: note.note_type === 'credit' ? note.amount : 0,
      })
    })

    entries.sort((a, b) => new Date(a.date) - new Date(b.date))

    let balance = 0
    const withBalance = entries.map((e) => {
      balance += e.debit - e.credit
      return { ...e, balance }
    })

    setLedgerEntries(withBalance)
    setLoading(false)
  }

  const finalBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-titan-dark">Party Ledger</h1>
        <p className="text-titan-steel text-sm">Full statement per customer — invoices, payments, notes</p>
      </div>

      <select className="input-field max-w-xs" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">Select a customer</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {customerId && (
        <>
          <div className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current Balance</p>
            <p className={`text-2xl font-bold mt-1 ${finalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{Math.abs(finalBalance).toLocaleString('en-IN')} {finalBalance > 0 ? '(owes you)' : finalBalance < 0 ? '(credit balance)' : ''}
            </p>
          </div>

          <div className="card overflow-x-auto p-0">
            {loading ? (
              <p className="p-5 text-titan-steel">Loading...</p>
            ) : (
              <table className="data-table w-full">
                <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
                <tbody>
                  {ledgerEntries.map((e, i) => (
                    <tr key={i}>
                      <td className="text-xs">{new Date(e.date).toLocaleDateString()}</td>
                      <td>{e.type}</td>
                      <td className="text-xs font-mono">{e.ref}</td>
                      <td>{e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '—'}</td>
                      <td>{e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="font-semibold">₹{e.balance.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {ledgerEntries.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-400 py-8">No transactions for this customer yet</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
