const labels: Record<string, string> = {
  name: 'Nome',
  cpf: 'CPF',
  birthDate: 'Nascimento',
  phone: 'Telefone',
  email: 'E-mail',
  sex: 'Sexo',
  zipCode: 'CEP',
  street: 'Logradouro',
  number: 'Número',
  complement: 'Complemento',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'UF',
  patientId: 'Paciente',
  encounterId: 'Atendimento',
  examTypeId: 'Tipo de exame',
  laterality: 'Lateralidade',
  notes: 'Observações',
  performedAt: 'Realização',
  resultText: 'Resultado',
  crm: 'CRM',
  crmState: 'UF do CRM',
  rqe: 'RQE',
  specialty: 'Especialidade',
  password: 'Senha',
  document: 'Documento',
}
export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p
      id={id}
      className="mt-1 text-sm text-red-800"
    >
      {message}
    </p>
  ) : null
}
export function FormErrorSummary({ errors, id }: { errors: object; id?: string }) {
  const entries = Object.entries(errors).flatMap(([key, value]) =>
    value && typeof value.message === 'string'
      ? [{ key, message: value.message as string }]
      : [],
  )
  if (!entries.length) return null
  return (
    <section
      id={id}
      data-form-errors
      tabIndex={-1}
      role="alert"
      aria-label="Revise o formulário"
      className="space-y-2 break-words rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
    >
      <p className="font-semibold">Não foi possível concluir. Revise os dados abaixo.</p>
      <ul className="list-inside list-disc">
        {entries.map(({ key, message }) => (
          <li key={key}>
            {labels[key] ? `${labels[key]}: ` : ''}
            {message}
          </li>
        ))}
      </ul>
    </section>
  )
}
