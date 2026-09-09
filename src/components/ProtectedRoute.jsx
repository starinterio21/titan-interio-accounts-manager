import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from './Layout'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-titan-steel">Loading...</div>
  }

  if (!session) return <Navigate to="/login" replace />

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <Layout>
        <div className="card text-center py-12">
          <p className="text-titan-steel">You don't have permission to view this page.</p>
        </div>
      </Layout>
    )
  }

  return <Layout>{children}</Layout>
}
