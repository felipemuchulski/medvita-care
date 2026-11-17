import { describe, expect, it } from 'vitest'
import { canCreate, canManage } from './appointment'

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
})
