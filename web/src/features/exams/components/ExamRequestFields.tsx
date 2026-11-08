import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import { inputClass } from '../../appointments/components/Selectors'
import { lateralityLabels } from '../lib/exam'
import type { ExamValues } from '../schemas/exam'
import type { ExamType } from '../types/exam'
import { ExamField } from './ExamField'
export function ExamRequestFields({
  register,
  errors,
  types,
}: {
  register: UseFormRegister<ExamValues>
  errors: FieldErrors<ExamValues>
  types: ExamType[]
}) {
  return (
    <>
      <ExamField
        id="exam-type"
        label="Tipo de exame"
        error={errors.examTypeId?.message}
      >
        <select
          id="exam-type"
          {...register('examTypeId')}
          className={inputClass}
          aria-invalid={Boolean(errors.examTypeId)}
          aria-describedby={errors.examTypeId ? 'exam-type-error' : undefined}
        >
          <option value="">Selecione um tipo</option>
          {types.map((type) => (
            <option
              key={type.id}
              value={type.id}
            >
              {type.name}
            </option>
          ))}
        </select>
      </ExamField>
      <ExamField
        id="exam-laterality"
        label="Lateralidade"
        error={errors.laterality?.message}
      >
        <select
          id="exam-laterality"
          {...register('laterality')}
          className={inputClass}
          aria-invalid={Boolean(errors.laterality)}
          aria-describedby={errors.laterality ? 'exam-laterality-error' : undefined}
        >
          {Object.entries(lateralityLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </ExamField>
      <div className="sm:col-span-2">
        <ExamField
          id="exam-notes"
          label="Observações (opcional)"
          error={errors.notes?.message}
        >
          <textarea
            id="exam-notes"
            {...register('notes')}
            rows={4}
            maxLength={4000}
            className={`${inputClass} h-auto min-h-28 resize-y`}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'exam-notes-error' : undefined}
          />
        </ExamField>
      </div>
    </>
  )
}
