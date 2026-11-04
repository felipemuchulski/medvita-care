import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { isApiError } from '../../../api/api-error'
import {
  patientSchema,
  patientToFormValues,
  toPatientPayload,
  type PatientFormValues,
} from '../lib/patient-schema'
import { maskCpf } from '../lib/patient-format'
import type { Patient, PatientPayload } from '../types/patient'

interface PatientFormProps {
  patient?: Patient
  submitLabel: string
  cancelTo: string
  onSubmit: (payload: PatientPayload) => Promise<void>
}

const inputClassName =
  'min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:opacity-70'
const labelClassName = 'block text-sm font-medium text-text-primary'
const errorClassName = 'mt-1 text-sm text-red-700'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null

  return <p id={id} role="alert" className={errorClassName}>{message}</p>
}

export default function PatientForm({ patient, submitLabel, cancelTo, onSubmit }: PatientFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: patientToFormValues(patient),
  })
  const cpfField = register('cpf')

  async function submit(values: PatientFormValues): Promise<void> {
    try {
      await onSubmit(toPatientPayload(values))
    } catch (error: unknown) {
      const message = isApiError(error)
        ? error.message
        : 'Não foi possível salvar o paciente.'
      if (/cpf/i.test(message)) {
        setError('cpf', { type: 'server', message })
      } else {
        setError('root', { type: 'server', message })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate aria-busy={isSubmitting} className="space-y-7">
      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Dados pessoais</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelClassName}>Nome completo *</label>
            <input id="name" autoComplete="name" maxLength={150} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('name')} />
            <FieldError id="name-error" message={errors.name?.message} />
          </div>
          <div>
            <label htmlFor="cpf" className={labelClassName}>CPF</label>
            <input {...cpfField} id="cpf" inputMode="numeric" maxLength={14} placeholder="000.000.000-00" aria-invalid={Boolean(errors.cpf)} aria-describedby={errors.cpf ? 'cpf-error' : undefined} disabled={isSubmitting} className={inputClassName} onChange={(event) => { event.target.value = maskCpf(event.target.value); void cpfField.onChange(event) }} />
            <FieldError id="cpf-error" message={errors.cpf?.message} />
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClassName}>Data de nascimento *</label>
            <input id="birthDate" type="date" required aria-invalid={Boolean(errors.birthDate)} aria-describedby={errors.birthDate ? 'birthDate-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('birthDate')} />
            <FieldError id="birthDate-error" message={errors.birthDate?.message} />
          </div>
          <div>
            <label htmlFor="sex" className={labelClassName}>Sexo</label>
            <select id="sex" aria-invalid={Boolean(errors.sex)} aria-describedby={errors.sex ? 'sex-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('sex')}>
              <option value="">Não informado</option>
              <option value="FEMALE">Feminino</option>
              <option value="MALE">Masculino</option>
              <option value="NOT_INFORMED">Prefere não informar</option>
            </select>
            <FieldError id="sex-error" message={errors.sex?.message} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Contato</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClassName}>Telefone</label>
            <input id="phone" type="tel" autoComplete="tel" maxLength={20} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'phone-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('phone')} />
            <FieldError id="phone-error" message={errors.phone?.message} />
          </div>
          <div>
            <label htmlFor="email" className={labelClassName}>E-mail</label>
            <input id="email" type="email" autoComplete="email" maxLength={150} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('email')} />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Endereço</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="zipCode" className={labelClassName}>CEP</label>
            <input id="zipCode" inputMode="numeric" autoComplete="postal-code" maxLength={9} aria-invalid={Boolean(errors.zipCode)} aria-describedby={errors.zipCode ? 'zipCode-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('zipCode')} />
            <FieldError id="zipCode-error" message={errors.zipCode?.message} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="street" className={labelClassName}>Logradouro</label>
            <input id="street" autoComplete="street-address" maxLength={150} aria-invalid={Boolean(errors.street)} aria-describedby={errors.street ? 'street-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('street')} />
            <FieldError id="street-error" message={errors.street?.message} />
          </div>
          <div>
            <label htmlFor="number" className={labelClassName}>Número</label>
            <input id="number" maxLength={20} aria-invalid={Boolean(errors.number)} aria-describedby={errors.number ? 'number-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('number')} />
            <FieldError id="number-error" message={errors.number?.message} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="complement" className={labelClassName}>Complemento</label>
            <input id="complement" maxLength={100} aria-invalid={Boolean(errors.complement)} aria-describedby={errors.complement ? 'complement-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('complement')} />
            <FieldError id="complement-error" message={errors.complement?.message} />
          </div>
          <div>
            <label htmlFor="neighborhood" className={labelClassName}>Bairro</label>
            <input id="neighborhood" maxLength={100} aria-invalid={Boolean(errors.neighborhood)} aria-describedby={errors.neighborhood ? 'neighborhood-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('neighborhood')} />
            <FieldError id="neighborhood-error" message={errors.neighborhood?.message} />
          </div>
          <div>
            <label htmlFor="city" className={labelClassName}>Cidade</label>
            <input id="city" autoComplete="address-level2" maxLength={100} aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? 'city-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('city')} />
            <FieldError id="city-error" message={errors.city?.message} />
          </div>
          <div>
            <label htmlFor="state" className={labelClassName}>UF</label>
            <input id="state" maxLength={2} autoComplete="address-level1" aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? 'state-error' : undefined} disabled={isSubmitting} className={inputClassName} {...register('state')} />
            <FieldError id="state-error" message={errors.state?.message} />
          </div>
        </div>
      </section>

      {errors.root && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errors.root.message}</p>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link to={cancelTo} aria-disabled={isSubmitting} onClick={(event) => { if (isSubmitting) event.preventDefault() }} className={`inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-white px-5 py-3 font-semibold text-text-primary transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}>
          Cancelar
        </Link>
        <button type="submit" disabled={isSubmitting} className="min-h-12 w-full rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          {isSubmitting ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
