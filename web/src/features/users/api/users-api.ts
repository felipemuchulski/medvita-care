import { httpClient } from '../../../api/http-client'
import type {
  CreateUserPayload,
  ManagedUser,
  UpdateUserPayload,
  UserQuery,
} from '../types/user'
// Allowlist responses before TanStack Query; never retain hashes or tokenVersion.
function publicUser(value: ManagedUser): ManagedUser {
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    active: value.active,
    isSystemAdmin: value.isSystemAdmin,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}
export const usersApi = {
  list: async (query: UserQuery, signal?: AbortSignal) =>
    (await httpClient.get<ManagedUser[]>('/users', { query: { ...query }, signal })).map(
      publicUser,
    ),
  detail: async (id: string, signal?: AbortSignal) =>
    publicUser(await httpClient.get<ManagedUser>(`/users/${id}`, { signal })),
  create: async (payload: CreateUserPayload) =>
    publicUser(await httpClient.post<ManagedUser>('/users', payload)),
  update: async (id: string, payload: UpdateUserPayload) =>
    publicUser(await httpClient.patch<ManagedUser>(`/users/${id}`, payload)),
  active: async (id: string, active: boolean) =>
    publicUser(await httpClient.patch<ManagedUser>(`/users/${id}/active`, { active })),
}
