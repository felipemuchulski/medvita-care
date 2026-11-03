export function formatCpf(value: string | null): string {
  if (!value) return 'Não informado'
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return value
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatZipCode(value: string | null): string {
  if (!value) return 'Não informado'
  const digits = value.replace(/\D/g, '')
  return digits.length === 8
    ? digits.replace(/(\d{5})(\d{3})/, '$1-$2')
    : value
}

export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
