import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { useEncounterMutations } from '../hooks/use-encounters'
import { useUnsavedClinicalChanges } from '../hooks/use-unsaved-clinical-changes'
import {
  clinicalError,
  completionReady,
  encounterSchema,
  toClinicalPayload,
  toEncounterValues,
  type EncounterValues,
} from '../lib/encounter'
import type { ClinicalPayload, ClinicalData } from '../types/encounter'
import { ClinicalDialog } from './ClinicalDialog'
import { ClinicalFormSections } from './ClinicalFormSections'
export function EncounterForm({
  encounter,
  clinic,
  user,
  preview = false,
}: {
  encounter: ClinicalData & { id: string; patient: { name: string } }
  clinic: string
  user: string
  preview?: boolean
}) {
  const mutations = useEncounterMutations(clinic, user)
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EncounterValues>({
    resolver: zodResolver(encounterSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldUnregister: false,
    defaultValues: toEncounterValues(encounter),
  })
  const [action, setAction] = useState<'complete' | 'cancel' | null>(null)
  const [completion, setCompletion] = useState<ClinicalPayload | null>(null)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const lock = useRef(false)
  const pending =
    isSubmitting ||
    mutations.save.isPending ||
    mutations.complete.isPending ||
    mutations.cancel.isPending
  const blocker = useUnsavedClinicalChanges(!preview && isDirty, pending)
  async function save(values: EncounterValues) {
    if (preview || lock.current) return
    lock.current = true
    setMessage('')
    try {
      const record = await mutations.save.mutateAsync({
        id: encounter.id,
        payload: toClinicalPayload(values),
      })
      reset(toEncounterValues(record))
      setMessage('Alterações salvas com sucesso.')
    } catch (error) {
      setError('root', { message: clinicalError(error) })
    } finally {
      lock.current = false
      mutations.save.reset()
    }
  }
  function prepareCompletion(values: EncounterValues) {
    const payload = toClinicalPayload(values)
    if (!completionReady(payload)) {
      const missing = (['chiefComplaint', 'clinicalAssessment', 'plan'] as const).filter(
        (name) => !payload[name]?.trim(),
      )
      missing.forEach((name) =>
        setError(name, {
          type: 'requiredForCompletion',
          message: 'Preencha este campo para concluir o atendimento.',
        }),
      )
      const firstMissing = missing[0]
      if (firstMissing) requestAnimationFrame(() => setFocus(firstMissing))
      return
    }
    setCompletion(payload)
    setActionError('')
    setAction('complete')
  }

  async function confirm() {
    if (preview || lock.current) return
    if (action === 'cancel' && (reason.trim().length < 3 || reason.trim().length > 500)) {
      setActionError('Informe uma justificativa de 3 a 500 caracteres.')
      return
    }
    lock.current = true
    setActionError('')
    try {
      const record =
        action === 'complete' && completion
          ? await mutations.complete.mutateAsync({
              id: encounter.id,
              payload: completion,
            })
          : await mutations.cancel.mutateAsync({
              id: encounter.id,
              reason: reason.trim(),
            })
      reset(toEncounterValues(record))
      setAction(null)
      setMessage(
        action === 'complete' ? 'Atendimento concluído.' : 'Atendimento cancelado.',
      )
    } catch (error) {
      setActionError(clinicalError(error))
    } finally {
      lock.current = false
      mutations.complete.reset()
      mutations.cancel.reset()
    }
  }
  let saveStatus = 'Sem alterações pendentes'
  if (preview) saveStatus = 'Prévia visual · sem salvamento'
  else if (pending) saveStatus = 'Salvando alterações...'
  else if (errors.root) saveStatus = 'Falha ao salvar — alterações preservadas'
  else if (isDirty) saveStatus = 'Alterações não salvas'
  else if (message) saveStatus = 'Alterações salvas'

  return (
    <>
      <form
        noValidate
        onSubmit={(event) => {
          if (preview) event.preventDefault()
          else void handleSubmit(save)(event)
        }}
        aria-busy={pending}
        className="w-full min-w-0 space-y-5"
      >
        <div className="space-y-4 rounded-xl border border-border bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Registro do atendimento</h2>
            <p
              role="status"
              className={`text-sm font-medium ${isDirty ? 'text-amber-800' : 'text-text-secondary'}`}
            >
              {saveStatus}
            </p>
          </div>
        </div>

        <fieldset
          disabled={pending}
          className="min-w-0 space-y-6"
        >
          <ClinicalFormSections
            register={register}
            control={control}
            errors={errors}
            setFocus={setFocus}
          />
          <section
            aria-label="Ações do atendimento"
            className="space-y-4 rounded-xl border border-border bg-white p-4 sm:p-5"
          >
            <p className="text-sm text-text-secondary">
              Para concluir, informe queixa principal, avaliação clínica e plano. Salve as
              alterações antes de sair.
            </p>
            {errors.root && (
              <p
                role="alert"
                className="text-red-800"
              >
                {errors.root.message}
              </p>
            )}
            {message && !isDirty && !errors.root && (
              <p
                role="status"
                className="rounded-lg bg-green-50 p-3 text-green-900"
              >
                {message}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                className={`${buttonClass} bg-primary text-white hover:bg-primary-dark`}
                disabled={pending || preview}
              >
                {pending ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={pending || preview}
                onClick={() => void handleSubmit(prepareCompletion)()}
              >
                Concluir atendimento
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={pending || preview}
                onClick={() => {
                  setActionError('')
                  setReason('')
                  setAction('cancel')
                }}
              >
                Cancelar atendimento
              </button>
            </div>
          </section>
        </fieldset>
      </form>
      {action && (
        <ClinicalDialog
          title={
            action === 'complete' ? 'Concluir atendimento?' : 'Cancelar atendimento?'
          }
          pending={pending}
          onClose={() => setAction(null)}
          onConfirm={() => void confirm()}
          label={action === 'complete' ? 'Confirmar conclusão' : 'Confirmar cancelamento'}
        >
          <p>
            {encounter.patient.name} ·{' '}
            {action === 'complete'
              ? 'Os dados serão salvos e o registro ficará somente para leitura.'
              : 'O atendimento e o agendamento vinculado serão cancelados. Alterações não salvas serão descartadas.'}
          </p>
          {action === 'cancel' && (
            <label className="form-field">
              <span>Justificativa obrigatória</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                maxLength={500}
                rows={3}
                disabled={pending || preview}
                className={inputClass.replace('h-11', 'min-h-11')}
              />
            </label>
          )}
          {actionError && (
            <p
              role="alert"
              className="text-red-800"
            >
              {actionError}
            </p>
          )}
        </ClinicalDialog>
      )}
      {blocker.state === 'blocked' && (
        <ClinicalDialog
          title={
            pending
              ? 'Salvamento em andamento'
              : isDirty
                ? 'Descartar alterações?'
                : 'Continuar navegação?'
          }
          onClose={() => blocker.reset()}
          onConfirm={() => {
            if (!pending) blocker.proceed()
          }}
          pending={pending}
          label={isDirty ? 'Descartar e sair' : 'Continuar'}
        >
          <p>
            {pending
              ? 'Aguarde a confirmação do servidor antes de sair.'
              : isDirty
                ? 'Há alterações clínicas não salvas. Sair desta página descartará essas alterações.'
                : 'As alterações foram salvas. Deseja continuar para a página solicitada?'}
          </p>
        </ClinicalDialog>
      )}
    </>
  )
}
