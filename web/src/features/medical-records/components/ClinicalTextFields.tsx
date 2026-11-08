import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import type { EncounterValues } from '../lib/encounter'
import { inputClass } from '../../appointments/components/Selectors'
import { textFields } from '../lib/encounter'

export function ClinicalTextFields({
  fields,
  register,
  errors,
}: {
  fields: readonly (typeof textFields)[number][]
  register: UseFormRegister<EncounterValues>
  errors: FieldErrors<EncounterValues>
}) {
  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const requiredForCompletion = [
          'chiefComplaint',
          'clinicalAssessment',
          'plan',
        ].includes(field.name)
        const descriptionId = `${field.name}-description`
        const errorId = `${field.name}-error`
        return (
          <div
            key={field.name}
            className="form-field"
          >
            <label
              htmlFor={field.name}
              className="font-medium"
            >
              {field.label}
            </label>
            <p
              id={descriptionId}
              className="text-xs text-text-secondary"
            >
              {requiredForCompletion
                ? 'Obrigatório para concluir; opcional no rascunho.'
                : field.name === 'anamnesis'
                  ? 'Registre a história relatada e os antecedentes relevantes neste campo.'
                  : 'Preenchimento opcional.'}
            </p>
            <textarea
              id={field.name}
              {...register(field.name)}
              rows={field.name === 'chiefComplaint' ? 3 : 5}
              maxLength={field.max}
              className={`${inputClass.replace('h-11', 'min-h-11')} resize-y leading-relaxed focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={`${descriptionId}${errors[field.name] ? ` ${errorId}` : ''}`}
            />
            {errors[field.name] && (
              <p
                id={errorId}
                role="alert"
                className="text-sm text-red-800"
              >
                {errors[field.name]?.message}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
