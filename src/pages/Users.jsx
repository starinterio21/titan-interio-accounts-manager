import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Users() {
  const { profile: currentProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    if (data) setUsers(data)
    setLoading(false)
  }

  async function updateRole(userId, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) alert('Error: ' + error.message)
    else loadUsers()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-titan-dark">Users</h1>
        <p className="text-titan-steel text-sm">Manage accounts and roles</p>
      </div>

      <div className="card bg-titan-gold/10 border-titan-gold/30 text-sm text-titan-steel">
        People create their own accounts from the Login page's "Create Account" tab.
        New accounts start as <strong>Staff</strong> — assign the Owner role here if needed.
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-titan-steel">Loading...</p>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="input-field py-1 text-xs"
                      value={u.role}
                      disabled={u.id === currentProfile.id}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                    >
                      <option value="owner">Owner</option>
                      <option value="staff">Staff</option>
                    </select>
                  </td>
                  <td className="text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
