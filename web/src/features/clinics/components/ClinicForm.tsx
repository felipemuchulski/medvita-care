import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { buttonClass } from '../../appointments/components/Selectors'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
import {
  clinicSchema,
  type ClinicFormInput,
  type ClinicFormValues,
} from '../schemas/clinic'
import { clinicError, formatClinicDocument } from '../lib/clinic'
import { useClinicMutations } from '../hooks/use-clinics'
import type { Clinic, CreateClinicPayload, UpdateClinicPayload } from '../types/clinic'
import { ClinicFormFields } from './ClinicFormFields'
const editable = [
  'name',
  'phone',
  'email',
  'street',
  'number',
  'complement',
  'neighborhood',
  'state',
] as const
export function ClinicForm({
  user,
  clinic,
  onSaved,
  back,
}: {
  user: string
  clinic?: Clinic
  onSaved: (clinic: Clinic) => void
  back: string
}) {
  const mutation = useClinicMutations(user)
  const lock = useRef(false)
  const [message, setMessage] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<ClinicFormInput, unknown, ClinicFormValues>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: clinic?.name || '',
      document: clinic ? formatClinicDocument(clinic.document) : '',
      phone: clinic?.phone || '',
      email: clinic?.email || '',
      zipCode: clinic?.zipCode || '',
      street: clinic?.street || '',
      number: clinic?.number || '',
      complement: clinic?.complement || '',
      neighborhood: clinic?.neighborhood || '',
      city: clinic?.city || '',
      state: clinic?.state || '',
    },
  })
  const blocker = useUnsavedClinicalChanges(
    isDirty,
    isSubmitting,
    'Há alterações não salvas no cadastro da clínica. Deseja descartá-las e continuar?',
  )
  async function submit(values: ClinicFormValues) {
    if (lock.current) return
    if (clinic?.email && dirtyFields.email && !values.email) {
      setError(
        'email',
        {
          message:
            'Informe um e-mail válido para alterar o atual. A remoção não está disponível nesta edição.',
        },
        { shouldFocus: true },
      )
      return
    }
    const payload: UpdateClinicPayload = {}
    if (clinic) {
      for (const field of editable) if (dirtyFields[field]) payload[field] = values[field]
      if (!Object.keys(payload).length) {
        setMessage('Nenhuma alteração para salvar.')
        return
      }
    }
    lock.current = true
    setMessage('')
    try {
      let saved: Clinic
      if (clinic) saved = await mutation.update.mutateAsync({ id: clinic.id, payload })
      else {
        const create: CreateClinicPayload = {
          name: values.name,
          document: values.document,
        }
        for (const field of [
          'phone',
          'email',
          'zipCode',
          'street',
          'number',
          'complement',
          'neighborhood',
          'city',
          'state',
        ] as const)
          if (values[field]) create[field] = values[field]
        saved = await mutation.create.mutateAsync(create)
      }
      reset(values)
      onSaved(saved)
    } catch (error) {
      setError('root', { message: clinicError(error) })
    } finally {
      lock.current = false
      mutation.create.reset()
      mutation.update.reset()
    }
  }
  return (
    <form
      onSubmit={(event) => void handleSubmit(submit)(event)}
      className="space-y-5"
      noValidate
      aria-busy={isSubmitting}
    >
      <p className="text-sm text-text-secondary">
        Campos marcados com * são obrigatórios.
      </p>
      <fieldset
        disabled={isSubmitting}
        className="min-w-0 space-y-5"
      >
        <ClinicFormFields
          register={register}
          errors={errors}
          edit={Boolean(clinic)}
        />
      </fieldset>
      {errors.root && (
        <p
          role="alert"
          className="text-red-800"
        >
          {errors.root.message}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className={buttonClass}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Salvando...'
            : clinic
              ? 'Salvar alterações'
              : 'Cadastrar clínica'}
        </button>
        <Link
          className={buttonClass}
          to={back}
        >
          Voltar
        </Link>
      </div>
      {blocker.state === 'blocked' && (
        <ClinicalDialog
          title={isSubmitting ? 'Aguarde o salvamento' : 'Descartar alterações?'}
          label="Descartar e continuar"
          pending={isSubmitting}
          onClose={() => blocker.reset()}
          onConfirm={() => {
            if (!isSubmitting) blocker.proceed()
          }}
        >
          <p>As alterações não salvas no cadastro serão descartadas ao continuar.</p>
        </ClinicalDialog>
      )}
    </form>
  )
}
