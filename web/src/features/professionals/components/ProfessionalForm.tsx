import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import {
  useEligibleProfessionalUsers,
  useProfessionals,
} from '../hooks/use-professionals'
import {
  eligibleMembers,
  professionalError,
  professionalSchema,
  states,
  type ProfessionalFormValues,
} from '../lib/professional'
import type {
  CreateProfessionalPayload,
  Professional,
  ProfessionalFields,
} from '../types/professional'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'

export function ProfessionalForm({
  clinic,
  professional,
  onSave,
}: {
  clinic: string
  professional?: Professional
  onSave: (
    payload: Partial<ProfessionalFields> | CreateProfessionalPayload,
  ) => Promise<void>
}) {
  const members = useEligibleProfessionalUsers(clinic, !professional)
  const profiles = useProfessionals(clinic)
  const candidates = eligibleMembers(members.data ?? [], profiles.data ?? [], clinic)
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const lock = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfessionalFormValues, unknown, ProfessionalFields>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      crm: professional?.crm ?? '',
      crmState: professional?.crmState ?? '',
      rqe: professional?.rqe ?? '',
      specialty: professional?.specialty ?? 'Oftalmologia',
    },
  })
  async function submit(fields: ProfessionalFields) {
    if (lock.current) return
    if (!professional && !candidates.some((m) => m.userId === userId)) {
      setError('root', { message: 'Selecione um usuário elegível da clínica.' })
      return
    }
    lock.current = true
    try {
      if (professional) {
        const payload: Partial<ProfessionalFields> = {}
        if (fields.crm !== professional.crm) payload.crm = fields.crm
        if (fields.crmState !== professional.crmState) payload.crmState = fields.crmState
        if (fields.rqe !== professional.rqe) payload.rqe = fields.rqe
        if (fields.specialty !== professional.specialty)
          payload.specialty = fields.specialty
        if (!Object.keys(payload).length) {
          setError('root', { message: 'Nenhuma alteração foi realizada.' })
          return
        }
        await onSave(payload)
      } else await onSave({ ...fields, userId })
    } catch (error) {
      setError('root', { message: professionalError(error) })
    } finally {
      lock.current = false
    }
  }
  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(submit)(event)}
      aria-busy={isSubmitting}
      className="space-y-5 rounded-xl border border-border bg-white p-4 sm:p-6"
    >
      <aside
        aria-label="Informação administrativa"
        className="my-[10px]! rounded-xl border border-gray-300 border-l-4 border-l-primary bg-gray-100 p-4"
      >
        <h2 className="mb-2 text-sm font-semibold text-primary">
          Informação administrativa
        </h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          O perfil é único por usuário. Alterações profissionais valem para todas as
          clínicas às quais ele está vinculado.
          {!professional &&
            ' Confira os dados antes de cadastrar: correções posteriores são restritas ao administrador do sistema.'}
        </p>
      </aside>
      <fieldset
        disabled={isSubmitting}
        className="min-w-0 space-y-5"
      >
        {professional ? (
          <p className="break-words font-medium">
            Usuário associado: {professional.user.name}
          </p>
        ) : (
          <section
            className="space-y-3"
            aria-label="Usuário associado"
          >
            <label className="form-field">
              <span className="font-medium">Pesquisar usuário elegível</span>
              <input
                type="search"
                className={inputClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou e-mail"
              />
            </label>
            {members.isPending || profiles.isPending ? (
              <p role="status">Carregando usuários da clínica...</p>
            ) : members.isError || profiles.isError ? (
              <div role="alert">
                <p>Não foi possível verificar os usuários elegíveis.</p>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    void members.refetch()
                    void profiles.refetch()
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <label className="form-field">
                  <span className="font-medium">Usuário associado *</span>
                  <select
                    className={inputClass}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    aria-invalid={Boolean(errors.root)}
                  >
                    <option value="">Selecione um usuário</option>
                    {candidates
                      .filter(
                        (m) =>
                          m.userId === userId ||
                          `${m.user?.name} ${m.user?.email}`
                            .toLocaleLowerCase('pt-BR')
                            .includes(search.trim().toLocaleLowerCase('pt-BR')),
                      )
                      .map((m) => (
                        <option
                          key={m.userId}
                          value={m.userId}
                        >
                          {m.user?.name} · {m.user?.email}
                        </option>
                      ))}
                  </select>
                </label>
                {!candidates.length && (
                  <>
                    <div className="mt-3 rounded-md bg-gray-200 p-4">
                      <p
                        role="status"
                        className="text-sm leading-relaxed text-text-primary"
                      >
                        Nenhum usuário elegível. É necessário um usuário ativo com vínculo
                        ativo de oftalmologista e sem perfil profissional existente.
                        Solicite a regularização dos vínculos à administração.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        )}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="form-field">
            <span>CRM *</span>
            <input
              {...register('crm')}
              maxLength={20}
              className={inputClass}
              aria-invalid={Boolean(errors.crm)}
              aria-describedby={errors.crm ? 'crm-error' : undefined}
            />
            {errors.crm && (
              <span
                id="crm-error"
                role="alert"
                className="block text-sm text-red-800"
              >
                {errors.crm.message}
              </span>
            )}
          </label>
          <label className="form-field">
            <span>UF do CRM *</span>
            <select
              {...register('crmState')}
              className={inputClass}
              aria-invalid={Boolean(errors.crmState)}
              aria-describedby={errors.crmState ? 'state-error' : undefined}
            >
              <option value="">Selecione</option>
              {states.map((s) => (
                <option
                  key={s}
                  value={s}
                >
                  {s}
                </option>
              ))}
            </select>
            {errors.crmState && (
              <span
                id="state-error"
                role="alert"
                className="block text-sm text-red-800"
              >
                {errors.crmState.message}
              </span>
            )}
          </label>
          <label className="form-field">
            <span>RQE</span>
            <input
              {...register('rqe')}
              maxLength={20}
              className={inputClass}
              aria-invalid={Boolean(errors.rqe)}
              aria-describedby={errors.rqe ? 'rqe-error' : undefined}
            />
            {errors.rqe && (
              <span
                id="rqe-error"
                role="alert"
                className="block text-sm text-red-800"
              >
                {errors.rqe.message}
              </span>
            )}
          </label>
          <label className="form-field">
            <span>Especialidade *</span>
            <input
              {...register('specialty')}
              maxLength={100}
              className={inputClass}
              aria-invalid={Boolean(errors.specialty)}
              aria-describedby={errors.specialty ? 'specialty-error' : undefined}
            />
            {errors.specialty && (
              <span
                id="specialty-error"
                role="alert"
                className="block text-sm text-red-800"
              >
                {errors.specialty.message}
              </span>
            )}
          </label>
        </div>
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
            className={buttonClass}
            type="submit"
            disabled={
              isSubmitting ||
              (!professional &&
                (members.isPending ||
                  profiles.isPending ||
                  members.isError ||
                  profiles.isError ||
                  !candidates.length))
            }
          >
            {isSubmitting
              ? 'Salvando...'
              : professional
                ? 'Salvar alterações'
                : 'Cadastrar profissional'}
          </button>
          {!isSubmitting && (
            <Link
              className={buttonClass}
              to={professional ? `/profissionais/${professional.id}` : '/profissionais'}
            >
              Voltar
            </Link>
          )}
        </div>
      </fieldset>
    </form>
  )
}
