import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { inputClass } from '../../appointments/components/Selectors'
import type { ClinicFormInput } from '../schemas/clinic'
const sections = [
  {
    title: 'Identificação',
    fields: [
      ['name', 'Nome da clínica *', 150],
      ['document', 'Documento (CNPJ) *', 32],
    ],
  },
  {
    title: 'Contato',
    fields: [
      ['email', 'E-mail', 150],
      ['phone', 'Telefone', 20],
    ],
  },
  {
    title: 'Endereço',
    fields: [
      ['zipCode', 'CEP', 8],
      ['street', 'Logradouro', 150],
      ['number', 'Número', 20],
      ['complement', 'Complemento', 100],
      ['neighborhood', 'Bairro', 100],
      ['city', 'Cidade', 100],
      ['state', 'Estado (sigla)', 2],
    ],
  },
] as const
export function ClinicFormFields({
  register,
  errors,
  edit,
}: {
  register: UseFormRegister<ClinicFormInput>
  errors: FieldErrors<ClinicFormInput>
  edit: boolean
}) {
  return (
    <>
      {sections.map((section) => (
        <fieldset
          key={section.title}
          className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 sm:p-6"
        >
          <legend className="px-1 text-lg font-semibold">{section.title}</legend>
          {section.fields.map(([name, label, max]) => {
            const readOnly = edit && ['document', 'zipCode', 'city'].includes(name)
            const error = errors[name]?.message
            const help = readOnly
              ? 'Disponível somente para consulta nesta edição.'
              : name === 'document'
                ? 'Até 14 letras ou números; a pontuação será removida.'
                : undefined
            return (
              <div
                key={name}
                className="form-field"
              >
                <label
                  htmlFor={`clinic-${name}`}
                  className="text-sm font-medium"
                >
                  {label}
                </label>
                <input
                  id={`clinic-${name}`}
                  {...register(name)}
                  type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'}
                  maxLength={max}
                  readOnly={readOnly}
                  className={`${inputClass} ${readOnly ? 'bg-background text-text-secondary' : ''}`}
                  aria-required={name === 'name' || name === 'document'}
                  aria-invalid={Boolean(error)}
                  aria-describedby={
                    [
                      help ? `clinic-${name}-help` : null,
                      error ? `clinic-${name}-error` : null,
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  autoComplete={
                    name === 'email'
                      ? 'email'
                      : name === 'phone'
                        ? 'tel'
                        : name === 'zipCode'
                          ? 'postal-code'
                          : name === 'street'
                            ? 'address-line1'
                            : name === 'city'
                              ? 'address-level2'
                              : name === 'state'
                                ? 'address-level1'
                                : undefined
                  }
                />
                {help && (
                  <p
                    id={`clinic-${name}-help`}
                    className="text-xs text-text-secondary"
                  >
                    {help}
                  </p>
                )}
                {error && (
                  <p
                    id={`clinic-${name}-error`}
                    role="alert"
                    className="text-sm text-red-800"
                  >
                    {error}
                  </p>
                )}
              </div>
            )
          })}
        </fieldset>
      ))}
    </>
  )
}
