import { FieldError, FormErrorSummary } from '../../../components/forms/FormFeedback'
import { useFormErrorFocus, formApiError } from '../../../lib/form-feedback'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { FocusEvent } from 'react'
import { Link } from 'react-router'
import { isApiError } from '../../../api/api-error'
import {
  patientSchema,
  patientToFormValues,
  toPatientPayload,
  type PatientFormValues,
} from '../lib/patient-schema'
import { editableCpf, maskPhone, maskZipCode } from '../lib/patient-format'
import type { Patient, PatientPayload } from '../types/patient'

interface PatientFormProps {
  patient?: Patient
  submitLabel: string
  cancelTo: string
  onSubmit: (payload: PatientPayload) => Promise<void>
}

const inputClassName =
  'min-h-11 w-full rounded-lg border border-control-border bg-white px-3 py-2 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:opacity-70'
const labelClassName = 'mb-1 block text-sm font-medium text-text-primary'

export default function PatientForm({
  patient,
  submitLabel,
  cancelTo,
  onSubmit,
}: PatientFormProps) {
  const { formRef, focusErrors } = useFormErrorFocus()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    shouldFocusError: false,
    defaultValues: patientToFormValues(patient),
  })
  const cpfField = register('cpf')
  const phoneField = register('phone')
  const zipField = register('zipCode')
  const formatOnBlur =
    (field: UseFormRegisterReturn, format: (value: string) => string) =>
    (event: FocusEvent<HTMLInputElement>) => {
      const next = format(event.currentTarget.value)
      if (next !== event.currentTarget.value) {
        event.currentTarget.value = next
        void field.onChange({ type: 'change', target: event.currentTarget })
      }
      void field.onBlur(event)
    }

  async function submit(values: PatientFormValues): Promise<void> {
    try {
      await onSubmit(toPatientPayload(values))
    } catch (error: unknown) {
      const messages = isApiError(error) ? error.messages : []
      let mapped = false
      if (isApiError(error) && [400, 409, 422].includes(error.status)) {
        for (const message of messages) {
          if (
            /^(?:cpf\b|o cpf\b|informe um cpf\b|já existe um paciente com este cpf)/i.test(
              message,
            )
          ) {
            setError('cpf', {
              type: 'server',
              message:
                error.status === 409
                  ? 'Já existe um paciente com este CPF nesta clínica.'
                  : 'Informe um CPF válido.',
            })
            mapped = true
          } else if (/^(?:name\b|o nome do paciente\b)/i.test(message)) {
            setError('name', {
              type: 'server',
              message: 'Informe um nome com 3 a 150 caracteres.',
            })
            mapped = true
          } else if (/^(?:phone\b|informe um telefone\b)/i.test(message)) {
            setError('phone', {
              type: 'server',
              message: 'Informe um telefone brasileiro com 10 ou 11 dígitos.',
            })
            mapped = true
          } else {
            const field = /^birthDate\b/i.test(message)
              ? 'birthDate'
              : /^email\b/i.test(message)
                ? 'email'
                : /^zipCode\b/i.test(message)
                  ? 'zipCode'
                  : /^state\b/i.test(message)
                    ? 'state'
                    : null
            if (field) {
              setError(field, {
                type: 'server',
                message: 'Confira o valor informado neste campo.',
              })
              mapped = true
            }
          }
        }
      }
      if (!mapped)
        setError('root', {
          type: 'server',
          message: formApiError(
            error,
            'Não foi possível salvar o paciente. Seus dados foram preservados.',
          ),
        })
      focusErrors()
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(submit, focusErrors)}
      noValidate
      aria-busy={isSubmitting}
      className="space-y-7"
    >
      <FormErrorSummary errors={errors} />
      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Dados pessoais</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="name"
              className={labelClassName}
            >
              Nome completo *
            </label>
            <input
              id="name"
              autoComplete="name"
              maxLength={150}
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('name')}
            />
            <FieldError
              id="name-error"
              message={errors.name?.message}
            />
          </div>
          <div>
            <label
              htmlFor="cpf"
              className={labelClassName}
            >
              CPF
            </label>
            <input
              {...cpfField}
              id="cpf"
              inputMode="numeric"
              maxLength={20}
              placeholder="000.000.000-00"
              aria-invalid={Boolean(errors.cpf)}
              aria-describedby={errors.cpf ? 'cpf-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              onBlur={formatOnBlur(cpfField, editableCpf)}
            />
            <FieldError
              id="cpf-error"
              message={errors.cpf?.message}
            />
          </div>
          <div>
            <label
              htmlFor="birthDate"
              className={labelClassName}
            >
              Data de nascimento *
            </label>
            <input
              id="birthDate"
              type="date"
              required
              aria-invalid={Boolean(errors.birthDate)}
              aria-describedby={errors.birthDate ? 'birthDate-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('birthDate')}
            />
            <FieldError
              id="birthDate-error"
              message={errors.birthDate?.message}
            />
          </div>
          <div>
            <label
              htmlFor="sex"
              className={labelClassName}
            >
              Sexo
            </label>
            <Controller
              name="sex"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  id="sex"
                  aria-invalid={Boolean(errors.sex)}
                  aria-describedby={errors.sex ? 'sex-error' : undefined}
                  disabled={isSubmitting}
                  className={inputClassName}
                >
                  <option value="">Não informado</option>
                  <option value="FEMALE">Feminino</option>
                  <option value="MALE">Masculino</option>
                  <option value="NOT_INFORMED">Prefere não informar</option>
                </select>
              )}
            />
            <FieldError
              id="sex-error"
              message={errors.sex?.message}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Contato</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="phone"
              className={labelClassName}
            >
              Telefone
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...phoneField}
              onBlur={formatOnBlur(phoneField, maskPhone)}
            />
            <FieldError
              id="phone-error"
              message={errors.phone?.message}
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className={labelClassName}
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={150}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('email')}
            />
            <FieldError
              id="email-error"
              message={errors.email?.message}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Endereço</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="zipCode"
              className={labelClassName}
            >
              CEP
            </label>
            <input
              id="zipCode"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              aria-invalid={Boolean(errors.zipCode)}
              aria-describedby={errors.zipCode ? 'zipCode-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...zipField}
              onBlur={formatOnBlur(zipField, maskZipCode)}
            />
            <FieldError
              id="zipCode-error"
              message={errors.zipCode?.message}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="street"
              className={labelClassName}
            >
              Logradouro
            </label>
            <input
              id="street"
              autoComplete="street-address"
              maxLength={150}
              aria-invalid={Boolean(errors.street)}
              aria-describedby={errors.street ? 'street-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('street')}
            />
            <FieldError
              id="street-error"
              message={errors.street?.message}
            />
          </div>
          <div>
            <label
              htmlFor="number"
              className={labelClassName}
            >
              Número
            </label>
            <input
              id="number"
              maxLength={20}
              aria-invalid={Boolean(errors.number)}
              aria-describedby={errors.number ? 'number-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('number')}
            />
            <FieldError
              id="number-error"
              message={errors.number?.message}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="complement"
              className={labelClassName}
            >
              Complemento
            </label>
            <input
              id="complement"
              maxLength={100}
              aria-invalid={Boolean(errors.complement)}
              aria-describedby={errors.complement ? 'complement-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('complement')}
            />
            <FieldError
              id="complement-error"
              message={errors.complement?.message}
            />
          </div>
          <div>
            <label
              htmlFor="neighborhood"
              className={labelClassName}
            >
              Bairro
            </label>
            <input
              id="neighborhood"
              maxLength={100}
              aria-invalid={Boolean(errors.neighborhood)}
              aria-describedby={errors.neighborhood ? 'neighborhood-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('neighborhood')}
            />
            <FieldError
              id="neighborhood-error"
              message={errors.neighborhood?.message}
            />
          </div>
          <div>
            <label
              htmlFor="city"
              className={labelClassName}
            >
              Cidade
            </label>
            <input
              id="city"
              autoComplete="address-level2"
              maxLength={100}
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? 'city-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('city')}
            />
            <FieldError
              id="city-error"
              message={errors.city?.message}
            />
          </div>
          <div>
            <label
              htmlFor="state"
              className={labelClassName}
            >
              UF
            </label>
            <input
              id="state"
              maxLength={2}
              autoComplete="address-level1"
              aria-invalid={Boolean(errors.state)}
              aria-describedby={errors.state ? 'state-error' : undefined}
              disabled={isSubmitting}
              className={inputClassName}
              {...register('state')}
            />
            <FieldError
              id="state-error"
              message={errors.state?.message}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          to={cancelTo}
          aria-disabled={isSubmitting}
          onClick={(event) => {
            if (isSubmitting) event.preventDefault()
          }}
          className={`inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-white px-5 py-3 font-semibold text-text-primary transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
