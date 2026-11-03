import { describe, expect, it } from 'vitest'
import { canChangePatientStatus, canReadPatients, canWritePatients } from './patient-permissions'

describe('patient permissions', () => {
  it.each(['ADMIN', 'RECEPTIONIST', 'OPHTHALMOLOGIST'] as const)('%s pode consultar pacientes', (role) => {
    expect(canReadPatients(role)).toBe(true)
  })

  it('limita escrita e status conforme o back-end', () => {
    expect(canWritePatients('ADMIN')).toBe(true)
    expect(canWritePatients('RECEPTIONIST')).toBe(true)
    expect(canWritePatients('OPHTHALMOLOGIST')).toBe(false)
    expect(canChangePatientStatus('ADMIN')).toBe(true)
    expect(canChangePatientStatus('RECEPTIONIST')).toBe(false)
    expect(canReadPatients(null)).toBe(false)
  })
})
