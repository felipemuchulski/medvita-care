import { describe, expect, it } from 'vitest'
import type { AuthenticatedUser } from '../../auth/types/auth'
import type { ClinicMembership } from '../types/clinic'
import { getAllowedMemberships } from './allowed-memberships'

const user: AuthenticatedUser = { id: 'user-1', name: 'User', email: 'user@example.com', isSystemAdmin: true, clinicRoles: [{ clinicId: 'clinic-1', role: 'ADMIN' }] }

describe('getAllowedMemberships', () => {
  it('não concede clínica apenas por isSystemAdmin e remove vínculos inativos', () => {
    const memberships = [
      { id: '1', clinicId: 'clinic-1', userId: 'user-1', role: 'ADMIN', active: true, clinic: { id: 'clinic-1', name: 'A', document: '1', active: true } },
      { id: '2', clinicId: 'clinic-2', userId: 'user-1', role: 'ADMIN', active: true, clinic: { id: 'clinic-2', name: 'B', document: '2', active: true } },
      { id: '3', clinicId: 'clinic-1', userId: 'user-1', role: 'ADMIN', active: false, clinic: { id: 'clinic-1', name: 'A', document: '1', active: true } },
    ] as ClinicMembership[]
    expect(getAllowedMemberships(user, memberships).map((item) => item.id)).toEqual(['1'])
  })
})
