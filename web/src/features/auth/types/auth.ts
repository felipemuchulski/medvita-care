export type ClinicRole = 'ADMIN' | 'RECEPTIONIST' | 'OPHTHALMOLOGIST'

export interface AuthenticatedClinicRole {
  clinicId: string
  role: ClinicRole
}

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  isSystemAdmin: boolean
  clinicRoles: AuthenticatedClinicRole[]
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthenticatedUser
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface MessageResponse {
  message: string
}
