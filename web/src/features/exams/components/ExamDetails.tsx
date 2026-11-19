import { FilterLink as Link } from '../../../components/filters/FilterLink'
import { useRef, useState } from 'react'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import { useExamMutations } from '../hooks/use-exams'
import { examDate, examError, lateralityLabels } from '../lib/exam'
import type { Exam } from '../types/exam'
import { ExamStatusBadge } from './ExamStatusBadge'
import { ExamResultForm } from './ExamResultForm'
import { ExamEditForm } from './ExamEditForm'
import { ExamField } from './ExamField'
export function ExamDetails({
  clinic,
  user,
  exam,
  navigationNotice = '',
}: {
  clinic: string
  user: string
  exam: Exam
  navigationNotice?: string
}) {
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'edit' | 'result' | null>(null)
  const [action, setAction] = useState<'complete' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const mutations = useExamMutations(clinic, user)
  const pending = mutations.complete.isPending || mutations.cancel.isPending
  const open = exam.status === 'REQUESTED' || exam.status === 'IN_PROGRESS'
  async function confirm() {
    if (lock.current) return
    if (action === 'cancel' && (!reason.trim() || reason.trim().length > 2000)) {
      setError('Informe um motivo de até 2.000 caracteres.')
      return
    }
    lock.current = true
    setError('')
    try {
      if (action === 'complete') await mutations.complete.mutateAsync(exam.id)
      else await mutations.cancel.mutateAsync({ id: exam.id, reason: reason.trim() })
      setMessage(
        action === 'complete'
          ? 'Exame concluído com sucesso.'
          : 'Exame cancelado com sucesso.',
      )
      setAction(null)
      setReason('')
    } catch (e) {
      setError(examError(e))
    } finally {
      lock.current = false
      mutations.complete.reset()
      mutations.cancel.reset()
    }
  }
  const saved = () => {
    setMode(null)
    setMessage('Alterações salvas com sucesso.')
  }
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Link
          className={buttonClass}
          to="/exames"
        >
          Voltar aos exames
        </Link>
        <Link
          className={buttonClass}
          to={`/prontuarios/pacientes/${exam.patientId}`}
        >
          Histórico do paciente
        </Link>
      </div>
      {(message || navigationNotice) && (
        <p
          role="status"
          className="rounded-lg bg-primary-light p-3 text-primary"
        >
          {message || navigationNotice}
        </p>
      )}
      <section
        className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
        aria-labelledby="exam-identification"
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <h2
            id="exam-identification"
            className="text-xl font-semibold"
          >
            {exam.examType.name}
          </h2>
          <ExamStatusBadge status={exam.status} />
        </header>
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Paciente</dt>
            <dd className="font-medium">{exam.patient.name}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Lateralidade</dt>
            <dd>{lateralityLabels[exam.laterality]}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Solicitante</dt>
            <dd>
              {exam.requestedByProfessional.user.name} · CRM{' '}
              {exam.requestedByProfessional.crm}/{exam.requestedByProfessional.crmState}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Solicitação</dt>
            <dd>{examDate(exam.requestedAt)}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Realização</dt>
            <dd>{examDate(exam.performedAt)}</dd>
          </div>
          {exam.completedAt && (
            <div>
              <dt className="text-text-secondary">Conclusão</dt>
              <dd>{examDate(exam.completedAt)}</dd>
            </div>
          )}
          {exam.cancelledAt && (
            <div>
              <dt className="text-text-secondary">Cancelamento</dt>
              <dd>{examDate(exam.cancelledAt)}</dd>
            </div>
          )}
          <div>
            <dt className="text-text-secondary">Atendimento associado</dt>
            <dd>
              {exam.encounterId ? (
                <Link
                  className="inline-flex min-h-11 items-center text-primary underline"
                  to={`/prontuarios/atendimentos/${exam.encounterId}`}
                >
                  Abrir atendimento · {examDate(exam.encounter?.startedAt || null)}
                </Link>
              ) : (
                'Sem atendimento associado'
              )}
            </dd>
          </div>
        </dl>
        {exam.notes && (
          <div>
            <h3 className="font-semibold">Observações</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{exam.notes}</p>
          </div>
        )}
      </section>
      <section
        className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4 sm:p-6"
        aria-labelledby="exam-result-title"
      >
        <h2
          id="exam-result-title"
          className="text-lg font-semibold"
        >
          Resultado
        </h2>
        <p className="whitespace-pre-wrap text-sm">
          {exam.resultText || 'Resultado ainda não registrado.'}
        </p>
        {exam.cancellationReason && (
          <div>
            <h3 className="font-semibold">Motivo do cancelamento</h3>
            <p className="whitespace-pre-wrap text-sm">{exam.cancellationReason}</p>
          </div>
        )}
      </section>
      {!open && (
        <p
          role="status"
          className="text-sm text-text-secondary"
        >
          Exame {exam.status === 'COMPLETED' ? 'concluído' : 'cancelado'}. Disponível
          somente para leitura.
        </p>
      )}
      {open && !mode && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {exam.status === 'REQUESTED' && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setMessage('')
                setMode('edit')
              }}
            >
              Editar solicitação
            </button>
          )}
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setMessage('')
              setMode('result')
            }}
          >
            {exam.resultText ? 'Editar resultado' : 'Registrar resultado'}
          </button>
          {exam.status === 'IN_PROGRESS' && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setError('')
                setAction('complete')
              }}
            >
              Concluir exame
            </button>
          )}
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setError('')
              setAction('cancel')
            }}
          >
            Cancelar exame
          </button>
        </div>
      )}
      {open && mode === 'result' && (
        <ExamResultForm
          clinic={clinic}
          user={user}
          exam={exam}
          onSaved={saved}
          onClose={() => setMode(null)}
        />
      )}
      {exam.status === 'REQUESTED' && mode === 'edit' && (
        <ExamEditForm
          clinic={clinic}
          user={user}
          exam={exam}
          onSaved={saved}
          onClose={() => setMode(null)}
        />
      )}
      {action && (
        <ClinicalDialog
          title={action === 'complete' ? 'Concluir exame?' : 'Cancelar exame?'}
          label={action === 'complete' ? 'Confirmar conclusão' : 'Confirmar cancelamento'}
          pending={pending}
          onClose={() => {
            setAction(null)
            setError('')
          }}
          onConfirm={() => void confirm()}
        >
          <p>
            {action === 'complete'
              ? 'Confira o resultado antes de concluir. Após a confirmação, o exame não poderá ser editado.'
              : 'O exame cancelado será mantido no histórico e não poderá ser editado.'}
          </p>
          {action === 'cancel' && (
            <ExamField
              id="exam-cancel-reason"
              label="Motivo do cancelamento"
              error={error || undefined}
            >
              <textarea
                id="exam-cancel-reason"
                rows={4}
                maxLength={2000}
                className={`${inputClass} h-auto min-h-28`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'exam-cancel-reason-error' : undefined}
              />
            </ExamField>
          )}
          {action === 'complete' && error && (
            <p
              role="alert"
              className="text-red-800"
            >
              {error}
            </p>
          )}
        </ClinicalDialog>
      )}
    </>
  )
}
