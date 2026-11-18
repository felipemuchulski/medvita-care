export function formatCpf(value: string | null): string {
  if (!value) return 'Não informado'
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return value
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

// Format on blur, not on every keystroke: deletion/paste and caret stay native.
// Invalid values are left intact for validation, never silently truncated.
export function editableCpf(value: string): string {
  return /^[\d.\s-]*$/.test(value) && value.replace(/\D/g, '').length <= 11
    ? maskCpf(value)
    : value
}
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!/^[\d() .-]*$/.test(value) || ![10, 11].includes(digits.length)) return value
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`
}
export function formatPhone(value: string | null): string {
  return value ? maskPhone(value) : 'Não informado'
}
export function maskZipCode(value: string): string {
  const digits = value.replace(/\D/g, '')
  return /^[\d\s-]*$/.test(value) && digits.length === 8
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : value
}

export function formatZipCode(value: string | null): string {
  if (!value) return 'Não informado'
  const digits = value.replace(/\D/g, '')
  return digits.length === 8 ? digits.replace(/(\d{5})(\d{3})/, '$1-$2') : value
}

export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
