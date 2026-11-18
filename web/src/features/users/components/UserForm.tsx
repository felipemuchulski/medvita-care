import { useRef, useState } from 'react'
import { useAuthorizationCheck } from '../../../lib/authorized-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
import { useAuth } from '../../../hooks/use-auth'
import { usersApi } from '../api/users-api'
import { useUserCommitted } from '../hooks/use-users'
import { createUserSchema, userSchema, type UserValues } from '../schemas/user'
import { userError } from '../lib/user'
import type { ManagedUser, UpdateUserPayload } from '../types/user'
export function UserForm({
  record,
  onSaved,
}: {
  record?: ManagedUser
  onSaved: (user: ManagedUser) => void
}) {
  const { user } = useAuth()
  const assertCurrent = useAuthorizationCheck()
  const committed = useUserCommitted()
  const [show, setShow] = useState(false)
  const [confirmation, setConfirmation] = useState<UserValues | null>(null)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<UserValues>({
    resolver: zodResolver(record ? userSchema : createUserSchema),
    defaultValues: {
      name: record?.name || '',
      email: record?.email || '',
      password: '',
      isSystemAdmin: record?.isSystemAdmin || false,
    },
  })
  const pending = isSubmitting || saving
  const blocker = useUnsavedClinicalChanges(
    isDirty,
    pending,
    'Há alterações não salvas no usuário. Deseja descartá-las e continuar?',
  )
  async function save(values: UserValues) {
    if (lock.current) return
    lock.current = true
    setSaving(true)
    try {
      assertCurrent()
      let saved: ManagedUser
      // Credentials never enter a TanStack Query mutation or cache.
      if (record) {
        const payload: UpdateUserPayload = {}
        for (const field of ['name', 'email', 'isSystemAdmin'] as const)
          if (dirtyFields[field]) Object.assign(payload, { [field]: values[field] })
        saved = Object.keys(payload).length
          ? await usersApi.update(record.id, payload)
          : record
      } else
        saved = await usersApi.create({
          name: values.name,
          email: values.email,
          password: values.password,
        })
      await committed(saved)
      assertCurrent()
      reset({ ...values, password: '' })
      setConfirmation(null)
      onSaved(saved)
    } catch (error) {
      setError('root', { message: userError(error) })
      setConfirmation(null)
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  async function submit(values: UserValues) {
    if (
      record &&
      ((dirtyFields.isSystemAdmin && values.isSystemAdmin !== record.isSystemAdmin) ||
        (record.id === user?.id && values.email !== record.email))
    ) {
      setConfirmation({ ...values, password: '' })
      return
    }
    await save(values)
  }
  return (
    <form
      onSubmit={(event) => void handleSubmit(submit)(event)}
      className="space-y-5"
      aria-busy={pending}
      noValidate
    >
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 sm:p-6"
      >
        <legend className="px-1 text-lg font-semibold">Identificação</legend>
        {(['name', 'email'] as const).map((name) => (
          <div
            key={name}
            className="form-field"
          >
            <label
              htmlFor={`user-${name}`}
              className="text-sm font-medium"
            >
              {name === 'name' ? 'Nome *' : 'E-mail *'}
            </label>
            <input
              id={`user-${name}`}
              type={name === 'email' ? 'email' : 'text'}
              {...register(name)}
              maxLength={150}
              className={inputClass}
              aria-required="true"
              aria-invalid={Boolean(errors[name])}
              aria-describedby={errors[name] ? `user-${name}-error` : undefined}
            />
            {errors[name] && (
              <p
                id={`user-${name}-error`}
                role="alert"
                className="text-sm text-red-800"
              >
                {errors[name]?.message}
              </p>
            )}
          </div>
        ))}
      </fieldset>
      {!record && (
        <fieldset
          disabled={pending}
          className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
        >
          <legend className="px-1 text-lg font-semibold">Credenciais iniciais</legend>
          <div className="form-field">
            <label
              htmlFor="user-password"
              className="text-sm font-medium"
            >
              Senha inicial *
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                id="user-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                maxLength={255}
                className={inputClass}
                aria-required="true"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? 'user-password-error' : 'user-password-help'
                }
              />
              <button
                type="button"
                className={buttonClass}
                aria-pressed={show}
                onClick={() => setShow((value) => !value)}
              >
                {show ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p
              id="user-password-help"
              className="text-xs text-text-secondary"
            >
              De 8 a 255 caracteres. Não há envio de convite por e-mail neste cadastro.
            </p>
            {errors.password && (
              <p
                id="user-password-error"
                role="alert"
                className="text-sm text-red-800"
              >
                {errors.password.message}
              </p>
            )}
          </div>
        </fieldset>
      )}
      {record && (
        <fieldset
          disabled={pending}
          className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4 sm:p-6"
        >
          <legend className="px-1 text-lg font-semibold">Acesso administrativo</legend>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              {...register('isSystemAdmin')}
              className="h-5 w-5"
            />
            <span>Administrador do sistema</span>
          </label>
          <p className="text-sm text-text-secondary">
            Esse acesso permite gerenciar cadastros globais. Não concede acesso clínico
            automático. Alterações de e-mail ou privilégio revogam as sessões do usuário.
          </p>
        </fieldset>
      )}
      {errors.root && (
        <p
          role="alert"
          className="text-red-800"
        >
          {errors.root.message}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className={buttonClass}
          disabled={pending}
        >
          {pending ? 'Salvando...' : record ? 'Salvar alterações' : 'Cadastrar usuário'}
        </button>
        <Link
          className={buttonClass}
          to={record ? `/usuarios/${record.id}` : '/usuarios'}
        >
          Voltar
        </Link>
      </div>
      {confirmation && (
        <ClinicalDialog
          title="Confirmar alteração de acesso?"
          label="Confirmar alteração"
          pending={saving}
          onClose={() => setConfirmation(null)}
          onConfirm={() => void save(confirmation)}
        >
          <p>
            A alteração de e-mail ou privilégio revoga as sessões do usuário. Se for a sua
            conta, será necessário entrar novamente.
          </p>
        </ClinicalDialog>
      )}
      {blocker.state === 'blocked' && (
        <ClinicalDialog
          title="Descartar alterações?"
          label="Descartar e continuar"
          pending={pending}
          onClose={() => blocker.reset()}
          onConfirm={() => {
            if (!pending) blocker.proceed()
          }}
        >
          <p>As alterações não salvas serão descartadas.</p>
        </ClinicalDialog>
      )}
    </form>
  )
}
