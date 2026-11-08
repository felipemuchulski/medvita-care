import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
import { useExamMutations } from '../hooks/use-exams'
import { examError, lateralityLabels } from '../lib/exam'
import { updateExamSchema, type UpdateExamValues } from '../schemas/exam'
import type { Exam } from '../types/exam'
import { ExamField } from './ExamField'
import { ExamLeavePrompt } from './ExamLeavePrompt'
export function ExamEditForm({
  clinic,
  user,
  exam,
  onSaved,
  onClose,
}: {
  clinic: string
  user: string
  exam: Exam
  onSaved: () => void
  onClose: () => void
}) {
  const mutation = useExamMutations(clinic, user).update
  const lock = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UpdateExamValues>({
    resolver: zodResolver(updateExamSchema),
    defaultValues: { laterality: exam.laterality, notes: exam.notes || '' },
  })
  const blocker = useUnsavedClinicalChanges(isDirty, isSubmitting)
  async function submit(values: UpdateExamValues) {
    if (lock.current) return
    lock.current = true
    try {
      await mutation.mutateAsync({ id: exam.id, payload: values })
      reset(values)
      onSaved()
    } catch (error) {
      setError('root', { message: examError(error) })
    } finally {
      lock.current = false
      mutation.reset()
    }
  }
  return (
    <form
      onSubmit={(event) => void handleSubmit(submit)(event)}
      className="space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
      aria-busy={isSubmitting}
      noValidate
    >
      <h2 className="text-lg font-semibold">Editar solicitação</h2>
      <fieldset
        disabled={isSubmitting}
        className="min-w-0 space-y-4"
      >
        <ExamField
          id="exam-edit-laterality"
          label="Lateralidade"
          error={errors.laterality?.message}
        >
          <select
            id="exam-edit-laterality"
            className={inputClass}
            {...register('laterality')}
            aria-invalid={Boolean(errors.laterality)}
            aria-describedby={
              errors.laterality ? 'exam-edit-laterality-error' : undefined
            }
          >
            {Object.entries(lateralityLabels).map(([value, label]) => (
              <option
                value={value}
                key={value}
              >
                {label}
              </option>
            ))}
          </select>
        </ExamField>
        <ExamField
          id="exam-edit-notes"
          label="Observações (opcional)"
          error={errors.notes?.message}
        >
          <textarea
            id="exam-edit-notes"
            rows={4}
            maxLength={4000}
            className={`${inputClass} h-auto min-h-28 resize-y`}
            {...register('notes')}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'exam-edit-notes-error' : undefined}
          />
        </ExamField>
      </fieldset>
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
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
        </button>
        <button
          className={buttonClass}
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            if (!isDirty || window.confirm('Descartar as alterações da solicitação?'))
              onClose()
          }}
        >
          Voltar aos detalhes
        </button>
      </div>
      <ExamLeavePrompt
        blocker={blocker}
        pending={isSubmitting}
      />
    </form>
  )
}
