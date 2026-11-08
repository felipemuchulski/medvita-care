import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'

export default function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <p role="status">Recuperando sessão…</p>

  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  return <Outlet />
}
