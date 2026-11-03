import { createContext } from 'react'
import type {
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
} from '../features/auth/types/auth'

export type AuthStatus = 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthenticatedUser | null
  login: (payload: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  changePassword: (payload: ChangePasswordRequest) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
