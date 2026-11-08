import { useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { clinicRoleLabels } from '../../clinics/lib/clinic'
import type { ClinicTeamMember } from '../../clinics/types/clinic'
import { useUsers } from '../../users/hooks/use-users'
import { userError } from '../../users/lib/user'
import { useClinicUserMutations } from '../hooks/use-clinic-user-mutations'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
const schema = z.object({
  userId: z.uuid('Selecione um usuário ativo.'),
  role: z.enum(['ADMIN', 'RECEPTIONIST', 'OPHTHALMOLOGIST']),
})
type Values = z.infer<typeof schema>
export function ClinicUserCreateForm({
  actor,
  clinic,
  members,
  onClose,
}: {
  actor: string
  clinic: string
  members: ClinicTeamMember[]
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const query = useUsers(actor, { email, active: true }, Boolean(email))
  const mutation = useClinicUserMutations(clinic).create
  const lock = useRef(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: '',
      role: members.some((m) => m.active && m.role === 'ADMIN')
        ? 'RECEPTIONIST'
        : 'ADMIN',
    },
  })
  const blocker = useUnsavedClinicalChanges(
    isDirty,
    isSubmitting,
    'Há um vínculo não salvo. Deseja descartá-lo e continuar?',
  )
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setValue('userId', '', { shouldDirty: true })
    setEmail(
      String(new FormData(e.currentTarget).get('email') || '')
        .trim()
        .toLowerCase(),
    )
  }
  async function submit(values: Values) {
    if (lock.current) return
    lock.current = true
    setMessage('')
    try {
      await mutation.mutateAsync(values)
      reset({ userId: '', role: values.role })
      setMessage('Usuário vinculado com sucesso.')
    } catch (e) {
      setError('root', { message: userError(e) })
    } finally {
      lock.current = false
      mutation.reset()
    }
  }
  const available =
    query.data?.filter(
      (user) => user.active && !members.some((m) => m.userId === user.id),
    ) || []
  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Vincular usuário existente</h2>
      <p className="text-sm text-text-secondary">
        Busque uma conta ativa por e-mail exato. Criar um vínculo não cria um perfil
        profissional.
      </p>
      <form
        onSubmit={search}
        className="space-y-3"
      >
        <div className="form-field">
          <label
            htmlFor="candidate-email"
            className="text-sm font-medium"
          >
            E-mail exato do usuário
          </label>
          <input
            id="candidate-email"
            type="email"
            name="email"
            required
            maxLength={150}
            className={inputClass}
            disabled={isSubmitting}
          />
        </div>
        <button
          className={buttonClass}
          type="submit"
          disabled={isSubmitting}
        >
          Buscar usuário
        </button>
      </form>
      {email && query.isPending && <p role="status">Buscando usuário...</p>}
      {query.isError && <p role="alert">{userError(query.error)}</p>}
      {email && query.isSuccess && !available.length && (
        <p role="status">
          Nenhum usuário ativo disponível para vínculo. Verifique o e-mail ou se a conta
          já pertence à equipe.
        </p>
      )}
      <form
        onSubmit={(event) => void handleSubmit(submit)(event)}
        className="space-y-4"
        noValidate
        aria-busy={isSubmitting}
      >
        <fieldset
          disabled={isSubmitting}
          className="grid min-w-0 gap-4 sm:grid-cols-2"
        >
          <div className="form-field">
            <label
              htmlFor="candidate-user"
              className="text-sm font-medium"
            >
              Usuário
            </label>
            <select
              id="candidate-user"
              {...register('userId')}
              className={inputClass}
              aria-invalid={Boolean(errors.userId)}
              aria-describedby={errors.userId ? 'candidate-user-error' : undefined}
            >
              <option value="">Selecione um usuário</option>
              {available.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name} · {user.email}
                </option>
              ))}
            </select>
            {errors.userId && (
              <p
                id="candidate-user-error"
                role="alert"
                className="text-sm text-red-800"
              >
                {errors.userId.message}
              </p>
            )}
          </div>
          <div className="form-field">
            <label
              htmlFor="candidate-role"
              className="text-sm font-medium"
            >
              Papel na clínica
            </label>
            <select
              id="candidate-role"
              {...register('role')}
              className={inputClass}
            >
              {Object.entries(clinicRoleLabels).map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        {!members.some((m) => m.active && m.role === 'ADMIN') && (
          <p className="text-sm text-text-secondary">
            O primeiro vínculo ativo deve ser ADMIN.
          </p>
        )}
        {errors.root && (
          <p
            role="alert"
            className="text-red-800"
          >
            {errors.root.message}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="text-primary"
          >
            {message}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className={buttonClass}
            disabled={isSubmitting || !available.length}
          >
            {isSubmitting ? 'Salvando...' : 'Vincular usuário'}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={isSubmitting}
            onClick={() => {
              if (!isDirty || window.confirm('Descartar os dados do novo vínculo?'))
                onClose()
            }}
          >
            Fechar
          </button>
        </div>
      </form>
      {blocker.state === 'blocked' && (
        <ClinicalDialog
          title="Descartar alterações?"
          label="Descartar e continuar"
          pending={isSubmitting}
          onClose={() => blocker.reset()}
          onConfirm={() => {
            if (!isSubmitting) blocker.proceed()
          }}
        >
          <p>Os dados não salvos do vínculo serão descartados.</p>
        </ClinicalDialog>
      )}
    </section>
  )
}
