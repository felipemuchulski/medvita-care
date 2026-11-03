import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'

export default function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'authenticated') return <Navigate to="/" replace />

  return <Outlet />
}
