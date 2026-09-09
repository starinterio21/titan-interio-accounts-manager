import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'bg-green-100 text-green-700' },
  { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700' },
  { value: 'half_day', label: 'Half Day', color: 'bg-orange-100 text-orange-700' },
  { value: 'leave', label: 'Leave', color: 'bg-blue-100 text-blue-700' },
]

export default function Attendance() {
  const { session } = useAuth()
  const [staffMembers, setStaffMembers] = useState([])
  const [attendanceMap, setAttendanceMap] = useState({}) // staff_member_id -> status
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [selectedDate])

  async function loadData() {
    setLoading(true)
    const [staffRes, attRes] = await Promise.all([
      supabase.from('staff_members').select('*').eq('active', true).order('name'),
      supabase.from('attendance').select('*').eq('date', selectedDate),
    ])
    if (staffRes.data) setStaffMembers(staffRes.data)
    if (attRes.data) {
      const map = {}
      attRes.data.forEach((a) => { map[a.staff_member_id] = a.status })
      setAttendanceMap(map)
    } else {
      setAttendanceMap({})
    }
    setLoading(false)
  }

  function setStatus(staffId, status) {
    setAttendanceMap((prev) => ({ ...prev, [staffId]: status }))
  }

  async function handleSaveAll() {
    setSaving(true)
    const rows = Object.entries(attendanceMap).map(([staff_member_id, status]) => ({
      staff_member_id,
      date: selectedDate,
      status,
      marked_by: session.user.id,
    }))

    if (rows.length === 0) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'staff_member_id,date' })
    if (error) alert('Error: ' + error.message)
    setSaving(false)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-titan-dark">Attendance</h1>
        <p className="text-titan-steel text-sm">Mark daily attendance for all staff</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="label mb-0">Date:</label>
        <input type="date" className="input-field max-w-xs" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      <div className="card p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : staffMembers.length === 0 ? (
          <p className="p-5 text-gray-400">No staff members yet — add them from Staff & Salary page first.</p>
        ) : (
          <ul>
            {staffMembers.map((staff) => (
              <li key={staff.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium text-titan-dark">{staff.name}</p>
                  <p className="text-xs text-gray-400">{staff.designation || ''}</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(staff.id, opt.value)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                        attendanceMap[staff.id] === opt.value
                          ? opt.color + ' border-transparent'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {staffMembers.length > 0 && (
        <button onClick={handleSaveAll} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : 'Save Attendance for ' + new Date(selectedDate).toLocaleDateString()}
        </button>
      )}
    </div>
  )
}
