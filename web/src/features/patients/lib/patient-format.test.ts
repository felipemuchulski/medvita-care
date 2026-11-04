import { describe, expect, it } from 'vitest'
import { maskCpf } from './patient-format'

describe('maskCpf', () => {
  it.each([
    ['5', '5'],
    ['5299', '529.9'],
    ['5299822', '529.982.2'],
    ['5299822472', '529.982.247-2'],
    ['52998224725', '529.982.247-25'],
  ])('formata progressivamente %s', (input, expected) => {
    expect(maskCpf(input)).toBe(expected)
  })

  it('aceita colagem formatada e limita o CPF a onze dígitos', () => {
    expect(maskCpf('529.982.247-25 extra 999')).toBe('529.982.247-25')
  })
})
