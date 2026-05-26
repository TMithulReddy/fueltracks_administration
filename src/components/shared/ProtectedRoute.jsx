import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'

/**
 * ProtectedRoute
 *
 * Props:
 *   allowedRoles — string[] of roles permitted (e.g. ['admin', 'super_admin'])
 *   children     — the page to render if access is granted
 */
export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner size="lg" fullPage />
  if (!user)   return <Navigate to="/" replace />

  if (profile?.must_change_password === true) {
    return <Navigate to="/change-password" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
