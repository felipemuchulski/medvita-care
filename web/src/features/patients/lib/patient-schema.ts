import { z } from 'zod'
import type { Patient, PatientPayload, PatientSex } from '../types/patient'
import { maskCpf } from './patient-format'

function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const calculateDigit = (length: number): number => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    value <= new Date().toISOString().slice(0, 10)
  )
}

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum, `Use no máximo ${maximum} caracteres.`)

const brazilianStates = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
])

export const patientSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .refine(
          (value) => Array.from(value).length >= 3,
          'Informe um nome com ao menos 3 caracteres.',
        )
        .max(150, 'Use no máximo 150 caracteres.'),
    ),
  cpf: z
    .string()
    .trim()
    .refine((value) => !value || isValidCpf(value), 'Informe um CPF válido.'),
  birthDate: z
    .string()
    .refine(isValidDateOnly, 'Informe uma data de nascimento válida e não futura.'),
  sex: z.enum(['', 'MALE', 'FEMALE', 'NOT_INFORMED']),
  phone: optionalText(20).refine(
    (value) =>
      !value ||
      (/^[\d() .-]+$/.test(value) && [10, 11].includes(value.replace(/\D/g, '').length)),
    'Informe um telefone brasileiro com 10 ou 11 dígitos.',
  ),
  email: z
    .string()
    .trim()
    .max(150)
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      'Informe um e-mail válido.',
    ),
  zipCode: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{5}-?\d{3}$/.test(value), 'Informe um CEP válido.'),
  street: optionalText(150),
  number: optionalText(20),
  complement: optionalText(100),
  neighborhood: optionalText(100),
  city: optionalText(100),
  state: z
    .string()
    .trim()
    .refine(
      (value) => !value || brazilianStates.has(value.toUpperCase()),
      'Informe uma UF brasileira válida.',
    ),
})

export type PatientFormValues = z.infer<typeof patientSchema>

export function patientToFormValues(patient?: Patient): PatientFormValues {
  return {
    name: patient?.name ?? '',
    cpf: maskCpf(patient?.cpf ?? ''),
    birthDate: patient?.birthDate ?? '',
    sex: patient?.sex ?? '',
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    zipCode: patient?.zipCode ?? '',
    street: patient?.street ?? '',
    number: patient?.number ?? '',
    complement: patient?.complement ?? '',
    neighborhood: patient?.neighborhood ?? '',
    city: patient?.city ?? '',
    state: patient?.state ?? '',
  }
}

function optional(value: string): string | null {
  const normalized = value.trim()
  return normalized || null
}

export function toPatientPayload(values: PatientFormValues): PatientPayload {
  return {
    name: values.name.trim().replace(/\s+/g, ' '),
    cpf: optional(values.cpf)?.replace(/\D/g, '') ?? null,
    birthDate: values.birthDate,
    sex: (values.sex || null) as PatientSex | null,
    phone: optional(values.phone),
    email: optional(values.email)?.toLowerCase() ?? null,
    zipCode: optional(values.zipCode)?.replace(/\D/g, '') ?? null,
    street: optional(values.street),
    number: optional(values.number),
    complement: optional(values.complement),
    neighborhood: optional(values.neighborhood),
    city: optional(values.city),
    state: optional(values.state)?.toUpperCase() ?? null,
  }
}
