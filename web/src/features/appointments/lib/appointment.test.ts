import { describe, expect, it } from 'vitest'
import { canCreate, canManage, canManageAppointment } from './appointment'
import type { Appointment } from '../types/appointment'

describe('appointment permissions', () => {
  it('allows ophthalmologists to create appointments', () => {
    expect(canCreate('OPHTHALMOLOGIST')).toBe(true)
    expect(canManage('OPHTHALMOLOGIST')).toBe(false)
  })

  it('preserves administrative permissions and requires a clinic role', () => {
    for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
      expect(canCreate(role)).toBe(true)
      expect(canManage(role)).toBe(true)
    }
    expect(canCreate(null)).toBe(false)
  })

  it('requires ownership, matching clinic, schedulable state and no encounter for physician changes', () => {
    const a = {
      clinicId: 'a',
      professionalId: 'profile',
      professional: { id: 'profile', userId: 'doctor' },
      status: 'SCHEDULED',
      encounter: null,
    } as Appointment
    expect(canManageAppointment(a, 'OPHTHALMOLOGIST', 'doctor', 'a')).toBe(true)
    expect(canManageAppointment(a, 'OPHTHALMOLOGIST', 'other', 'a')).toBe(false)
    expect(canManageAppointment(a, 'OPHTHALMOLOGIST', 'doctor', 'b')).toBe(false)
    expect(canManageAppointment(a, null, 'doctor', 'a')).toBe(false)
    expect(canManageAppointment(a, 'OPHTHALMOLOGIST', undefined, 'a')).toBe(false)
    expect(
      canManageAppointment(
        { ...a, status: 'CANCELLED' },
        'OPHTHALMOLOGIST',
        'doctor',
        'a',
      ),
    ).toBe(false)
    expect(
      canManageAppointment(
        { ...a, encounter: { id: 'e', status: 'COMPLETED' } },
        'OPHTHALMOLOGIST',
        'doctor',
        'a',
      ),
    ).toBe(false)
    for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
      expect(canManageAppointment(a, role, 'staff', 'a')).toBe(true)
      expect(
        canManageAppointment({ ...a, status: 'IN_PROGRESS' }, role, 'staff', 'a'),
      ).toBe(false)
    }
  })
})
