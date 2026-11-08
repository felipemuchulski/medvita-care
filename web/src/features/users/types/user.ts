export interface ManagedUser {
  id: string
  name: string
  email: string
  active: boolean
  isSystemAdmin: boolean
  createdAt?: string
  updatedAt?: string
}
export interface UserQuery {
  email?: string
  active?: boolean
}
export interface CreateUserPayload {
  name: string
  email: string
  password: string
}
export interface UpdateUserPayload {
  name?: string
  email?: string
  isSystemAdmin?: boolean
}
