import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { inputClass } from '../../appointments/components/Selectors'
import type { EncounterValues } from '../lib/encounter'
export function OcularMeasurements({
  control,
  errors,
  kind,
}: {
  control: Control<EncounterValues>
  errors: FieldErrors<EncounterValues>
  kind: 'acuity' | 'pressure'
}) {
  const pressure = kind === 'pressure'
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      {(['Right', 'Left'] as const).map((side) => {
        const name = pressure
          ? (`intraocularPressure${side}` as const)
          : (`visualAcuity${side}` as const)
        const eye = side === 'Right' ? 'OD' : 'OS'
        return (
          <fieldset
            key={side}
            className="min-w-0 rounded-lg border border-border bg-background/40 p-4"
          >
            <legend className="px-1 text-sm font-semibold">
              {side === 'Right' ? 'Olho direito (OD)' : 'Olho esquerdo (OS)'}
            </legend>
            <div className="form-field">
              <label
                htmlFor={name}
                className="font-medium"
              >
                {pressure ? 'Pressão intraocular' : 'Acuidade visual'} {eye}
              </label>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <input
                    {...field}
                    id={name}
                    inputMode={pressure ? 'decimal' : undefined}
                    maxLength={pressure ? undefined : 50}
                    className={`${inputClass} focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                    aria-invalid={Boolean(errors[name])}
                    aria-describedby={`${name}-description${errors[name] ? ` ${name}-error` : ''}`}
                  />
                )}
              />
              <p
                id={`${name}-description`}
                className="text-xs text-text-secondary"
              >
                {pressure
                  ? 'Opcional. Aceita até duas casas decimais.'
                  : 'Opcional. Registre a medida conforme a avaliação.'}
              </p>
              {errors[name] && (
                <p
                  id={`${name}-error`}
                  role="alert"
                  className="text-sm text-red-800"
                >
                  {errors[name]?.message}
                </p>
              )}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
