import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPayable: 0, totalReceivable: 0, monthPurchases: 0, monthSales: 0, monthSalary: 0, monthExpenses: 0,
  })
  const [overduePurchases, setOverduePurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    const [purchRes, invRes, salRes, expRes] = await Promise.all([
      supabase.from('purchases').select('*, suppliers(name)'),
      supabase.from('invoices').select('*'),
      supabase.from('salary_payments').select('*').eq('month', now.getMonth() + 1).eq('year', now.getFullYear()),
      supabase.from('expenses').select('*'),
    ])

    const purchases = purchRes.data || []
    const invoices = invRes.data || []
    const salaries = salRes.data || []
    const expenses = expRes.data || []

    const totalPayable = purchases.reduce((sum, p) => sum + (p.total_amount - p.amount_paid), 0)
    const totalReceivable = invoices.reduce((sum, i) => sum + (i.total_amount - i.amount_received), 0)
    const monthPurchases = purchases.filter((p) => p.bill_date >= monthStart).reduce((sum, p) => sum + p.total_amount, 0)
    const monthSales = invoices.filter((i) => i.invoice_date >= monthStart).reduce((sum, i) => sum + i.total_amount, 0)
    const monthSalary = salaries.reduce((sum, s) => sum + Number(s.net_pay), 0)
    const monthExpenses = expenses.filter((e) => e.expense_date >= monthStart).reduce((sum, e) => sum + Number(e.amount), 0)

    const today = now.toISOString().slice(0, 10)
    const overdue = purchases.filter((p) => p.due_date && p.due_date < today && p.status !== 'paid')

    setStats({ totalPayable, totalReceivable, monthPurchases, monthSales, monthSalary, monthExpenses })
    setOverduePurchases(overdue)
    setLoading(false)
  }

  if (loading) return <p className="text-titan-steel">Loading dashboard...</p>

  const roughProfit = stats.monthSales - stats.monthPurchases - stats.monthSalary - stats.monthExpenses

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-titan-dark">Dashboard</h1>
        <p className="text-titan-steel text-sm">Business overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">You Owe Suppliers</p>
          <p className="text-2xl font-bold text-red-600 mt-1">₹{stats.totalPayable.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Customers Owe You</p>
          <p className="text-2xl font-bold text-green-600 mt-1">₹{stats.totalReceivable.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Month Purchases</p>
          <p className="text-xl font-bold text-titan-dark mt-1">₹{stats.monthPurchases.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Month Sales</p>
          <p className="text-xl font-bold text-titan-dark mt-1">₹{stats.monthSales.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Month Salary</p>
          <p className="text-xl font-bold text-titan-dark mt-1">₹{stats.monthSalary.toLocaleString('en-IN')}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Month Expenses</p>
          <p className="text-xl font-bold text-titan-dark mt-1">₹{stats.monthExpenses.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="card">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Rough Profit Indicator (This Month)</p>
        <p className={`text-2xl font-bold mt-1 ${roughProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ₹{roughProfit.toLocaleString('en-IN')}
        </p>
        <p className="text-xs text-gray-400 mt-1">Sales − Purchases − Salary − Expenses. A rough estimate, not full accounting.</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-titan-dark mb-3">Overdue Supplier Payments</h2>
        {overduePurchases.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing overdue. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {overduePurchases.map((p) => (
              <li key={p.id} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <p className="font-medium text-titan-dark">{p.suppliers?.name}</p>
                  <p className="text-xs text-gray-400">Due {new Date(p.due_date).toLocaleDateString()}</p>
                </div>
                <span className="text-red-600 font-semibold">₹{(p.total_amount - p.amount_paid).toLocaleString('en-IN')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
