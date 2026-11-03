import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { isApiError } from '../../../api/api-error'
import {
  patientSchema,
  patientToFormValues,
  toPatientPayload,
  type PatientFormValues,
} from '../lib/patient-schema'
import type { Patient, PatientPayload } from '../types/patient'

interface PatientFormProps {
  patient?: Patient
  submitLabel: string
  onSubmit: (payload: PatientPayload) => Promise<void>
}

const inputClassName =
  'min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:opacity-70'
const labelClassName = 'block text-sm font-medium text-text-primary'
const errorClassName = 'mt-1 text-sm text-red-700'

export default function PatientForm({ patient, submitLabel, onSubmit }: PatientFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: patientToFormValues(patient),
  })

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
            <input id="name" autoComplete="name" disabled={isSubmitting} className={inputClassName} {...register('name')} />
            {errors.name && <p className={errorClassName}>{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="cpf" className={labelClassName}>CPF</label>
            <input id="cpf" inputMode="numeric" placeholder="000.000.000-00" disabled={isSubmitting} className={inputClassName} {...register('cpf')} />
            {errors.cpf && <p className={errorClassName}>{errors.cpf.message}</p>}
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClassName}>Data de nascimento *</label>
            <input id="birthDate" type="date" disabled={isSubmitting} className={inputClassName} {...register('birthDate')} />
            {errors.birthDate && <p className={errorClassName}>{errors.birthDate.message}</p>}
          </div>
          <div>
            <label htmlFor="sex" className={labelClassName}>Sexo</label>
            <select id="sex" disabled={isSubmitting} className={inputClassName} {...register('sex')}>
              <option value="">Não informado</option>
              <option value="FEMALE">Feminino</option>
              <option value="MALE">Masculino</option>
              <option value="NOT_INFORMED">Prefere não informar</option>
            </select>
            {errors.sex && <p className={errorClassName}>{errors.sex.message}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Contato</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClassName}>Telefone</label>
            <input id="phone" type="tel" autoComplete="tel" disabled={isSubmitting} className={inputClassName} {...register('phone')} />
            {errors.phone && <p className={errorClassName}>{errors.phone.message}</p>}
          </div>
          <div>
            <label htmlFor="email" className={labelClassName}>E-mail</label>
            <input id="email" type="email" autoComplete="email" disabled={isSubmitting} className={inputClassName} {...register('email')} />
            {errors.email && <p className={errorClassName}>{errors.email.message}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Endereço</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="zipCode" className={labelClassName}>CEP</label>
            <input id="zipCode" inputMode="numeric" autoComplete="postal-code" disabled={isSubmitting} className={inputClassName} {...register('zipCode')} />
            {errors.zipCode && <p className={errorClassName}>{errors.zipCode.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="street" className={labelClassName}>Logradouro</label>
            <input id="street" autoComplete="street-address" disabled={isSubmitting} className={inputClassName} {...register('street')} />
            {errors.street && <p className={errorClassName}>{errors.street.message}</p>}
          </div>
          <div>
            <label htmlFor="number" className={labelClassName}>Número</label>
            <input id="number" disabled={isSubmitting} className={inputClassName} {...register('number')} />
            {errors.number && <p className={errorClassName}>{errors.number.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="complement" className={labelClassName}>Complemento</label>
            <input id="complement" disabled={isSubmitting} className={inputClassName} {...register('complement')} />
            {errors.complement && <p className={errorClassName}>{errors.complement.message}</p>}
          </div>
          <div>
            <label htmlFor="neighborhood" className={labelClassName}>Bairro</label>
            <input id="neighborhood" disabled={isSubmitting} className={inputClassName} {...register('neighborhood')} />
            {errors.neighborhood && <p className={errorClassName}>{errors.neighborhood.message}</p>}
          </div>
          <div>
            <label htmlFor="city" className={labelClassName}>Cidade</label>
            <input id="city" autoComplete="address-level2" disabled={isSubmitting} className={inputClassName} {...register('city')} />
            {errors.city && <p className={errorClassName}>{errors.city.message}</p>}
          </div>
          <div>
            <label htmlFor="state" className={labelClassName}>UF</label>
            <input id="state" maxLength={2} autoComplete="address-level1" disabled={isSubmitting} className={inputClassName} {...register('state')} />
            {errors.state && <p className={errorClassName}>{errors.state.message}</p>}
          </div>
        </div>
      </section>

      {errors.root && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errors.root.message}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="min-h-12 w-full rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          {isSubmitting ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
