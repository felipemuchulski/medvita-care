import type { AuthenticatedUser } from '../features/auth/types/auth'
import { ApiError } from '../api/api-error'

type AuthorizationState = {
  user: AuthenticatedUser | null
  clinicId: string | null
  identity: number
  revision: number
  blocked: boolean
  reason: 'initial' | 'identity' | 'permissions' | 'clinic-selection' | 'forbidden'
  notice: string | null
}
let state: AuthorizationState = {
  user: null,
  clinicId: null,
  identity: 0,
  revision: 0,
  blocked: false,
  reason: 'initial',
  notice: null,
}
let controller = new AbortController()
const listeners = new Set<() => void>()
export const getAuthorization = () => state
export const subscribeAuthorization = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const authorizationSignal = () => controller.signal
export function announceAuthorizationNotice(notice: string) {
  state = { ...state, notice }
  listeners.forEach((listener) => listener())
}
export const permissionSignature = (user: AuthenticatedUser | null) =>
  JSON.stringify(
    user && [
      user.id,
      user.isSystemAdmin,
      user.clinicRoles
        .map((m) => [m.clinicId, m.role])
        .sort((a, b) => a[0].localeCompare(b[0])),
    ],
  )
function advance(patch: Partial<AuthorizationState>) {
  controller.abort()
  controller = new AbortController()
  state = { ...state, ...patch, revision: state.revision + 1 }
  listeners.forEach((listener) => listener())
}
export function setAuthorizationUser(user: AuthenticatedUser | null, newSession = false) {
  const identityChanged = newSession || state.user?.id !== user?.id
  if (
    !identityChanged &&
    permissionSignature(state.user) === permissionSignature(user) &&
    !state.blocked
  )
    return
  advance({
    user,
    blocked: false,
    identity: state.identity + Number(identityChanged),
    clinicId: identityChanged ? null : state.clinicId,
    reason: identityChanged ? 'identity' : 'permissions',
    notice: identityChanged
      ? state.user && !user
        ? 'Sessão encerrada. Alterações não salvas não foram enviadas.'
        : null
      : 'Suas permissões foram atualizadas.',
  })
}
export function setAuthorizationClinic(clinicId: string | null, voluntary = false) {
  if (state.clinicId === clinicId) return
  advance({
    clinicId,
    reason: voluntary || state.clinicId === null ? 'clinic-selection' : 'permissions',
    notice: voluntary ? null : state.notice,
  })
}
export function quarantineAuthorization() {
  if (state.blocked) return
  advance({
    blocked: true,
    reason: 'forbidden',
    notice:
      'O acesso foi alterado ou negado. Os dados anteriores foram ocultados enquanto verificamos suas permissões.',
  })
}
export function assertAuthorization(revision: number, identityOnly = false) {
  if (
    identityOnly
      ? revision !== state.identity
      : revision !== state.revision || state.blocked
  ) {
    throw ApiError.aborted(new Error('Authorization context changed'))
  }
}
