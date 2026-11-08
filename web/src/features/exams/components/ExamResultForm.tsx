import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
import { useExamMutations } from '../hooks/use-exams'
import { examError, localDateTime, resultDate } from '../lib/exam'
import { resultSchema, type ResultValues } from '../schemas/exam'
import type { Exam } from '../types/exam'
import { ExamField } from './ExamField'
import { ExamLeavePrompt } from './ExamLeavePrompt'
export function ExamResultForm({
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
  const mutation = useExamMutations(clinic, user).result
  const lock = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ResultValues>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      resultText: exam.resultText || '',
      performedAt: localDateTime(exam.performedAt || new Date().toISOString()),
    },
  })
  const blocker = useUnsavedClinicalChanges(isDirty, isSubmitting)
  async function submit(values: ResultValues) {
    if (lock.current) return
    const performedAt = resultDate(values.performedAt, exam.requestedAt)
    if (
      Date.parse(performedAt) < Date.parse(exam.requestedAt) ||
      Date.parse(performedAt) > Date.now()
    ) {
      setError('performedAt', {
        message: 'Informe uma realização entre a solicitação e o momento atual.',
      })
      return
    }
    lock.current = true
    try {
      await mutation.mutateAsync({
        id: exam.id,
        payload: { resultText: values.resultText, performedAt },
      })
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
      <h2 className="text-lg font-semibold">Registrar resultado</h2>
      <fieldset
        disabled={isSubmitting}
        className="min-w-0 space-y-4"
      >
        <ExamField
          id="exam-performed"
          label="Data e horário de realização (UTC−03:00)"
          error={errors.performedAt?.message}
        >
          <input
            type="datetime-local"
            step="1"
            id="exam-performed"
            className={inputClass}
            {...register('performedAt')}
            aria-invalid={Boolean(errors.performedAt)}
            aria-describedby={errors.performedAt ? 'exam-performed-error' : undefined}
          />
        </ExamField>
        <ExamField
          id="exam-result"
          label="Resultado descritivo"
          error={errors.resultText?.message}
        >
          <textarea
            id="exam-result"
            className={`${inputClass} h-auto min-h-40 resize-y`}
            rows={8}
            maxLength={12000}
            {...register('resultText')}
            aria-invalid={Boolean(errors.resultText)}
            aria-describedby={errors.resultText ? 'exam-result-error' : undefined}
          />
        </ExamField>
      </fieldset>
      <p className="text-sm text-text-secondary">
        Salvar o resultado coloca o exame em andamento. A conclusão é feita separadamente
        e impede novas alterações.
      </p>
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
          {isSubmitting ? 'Salvando...' : 'Salvar resultado'}
        </button>
        <button
          className={buttonClass}
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            if (!isDirty || window.confirm('Descartar as alterações do resultado?'))
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
