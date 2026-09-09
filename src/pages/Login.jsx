import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
      else navigate('/')
    } else {
      const { error } = await signUp(email, password, fullName)
      if (error) setError(error.message)
      else setInfo('Account created! New accounts start as "Staff" — ask the Owner to upgrade your role in Users, then sign in below.')
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-titan-dark px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Titan Interio" className="w-28 h-28 object-contain mb-3" />
          <h1 className="text-titan-gold font-bold text-lg tracking-wide">TITAN INTERIO</h1>
          <p className="text-gray-400 text-xs tracking-wider">ACCOUNTS MANAGER</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex mb-5 border-b border-gray-200">
            <button className={`flex-1 pb-2 text-sm font-medium ${mode === 'login' ? 'text-titan-dark border-b-2 border-titan-gold' : 'text-gray-400'}`} onClick={() => { setMode('login'); setError(''); setInfo('') }}>Sign In</button>
            <button className={`flex-1 pb-2 text-sm font-medium ${mode === 'signup' ? 'text-titan-dark border-b-2 border-titan-gold' : 'text-gray-400'}`} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>Create Account</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {info && <p className="text-green-700 text-sm">{info}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full justify-center flex">
              {busy ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
