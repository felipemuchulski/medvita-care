import { describe, expect, it } from 'vitest'
import { patientSchema, toPatientPayload } from './patient-schema'

const validPatient = {
  name: 'Maria da Silva',
  cpf: '529.982.247-25',
  birthDate: '1990-05-20',
  sex: 'FEMALE' as const,
  phone: '',
  email: 'MARIA@EXAMPLE.COM',
  zipCode: '01310-100',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: 'São Paulo',
  state: 'sp',
}

describe('patientSchema', () => {
  it('valida e normaliza um paciente', () => {
    const values = patientSchema.parse(validPatient)
    expect(toPatientPayload(values)).toMatchObject({
      cpf: '52998224725',
      email: 'maria@example.com',
      zipCode: '01310100',
      state: 'SP',
      phone: null,
    })
  })

  it('rejeita CPF inválido e nascimento futuro', () => {
    const result = patientSchema.safeParse({
      ...validPatient,
      cpf: '111.111.111-11',
      birthDate: '2999-01-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['cpf', 'birthDate']),
      )
    }
  })
})
