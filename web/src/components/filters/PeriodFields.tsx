import { useId } from 'react'
export function PeriodFields({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (patch: Record<string, string>) => void
}) {
  const id = useId()
  const invalid = Boolean(from && to && from > to)
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {(['from', 'to'] as const).map((field) => (
        <label
          key={field}
          className="form-field min-w-0"
        >
          <span>{field === 'from' ? 'Início do período' : 'Fim do período'}</span>
          <input
            type="date"
            value={field === 'from' ? from : to}
            aria-invalid={invalid}
            aria-describedby={invalid ? id : undefined}
            onChange={(event) => onChange({ [field]: event.target.value })}
            className="min-h-11 w-full min-w-0 rounded-lg border border-control-border bg-white px-3 py-2 text-base"
          />
        </label>
      ))}
      {invalid && (
        <p
          id={id}
          role="alert"
          className="text-sm text-red-800 sm:col-span-2"
        >
          O fim do período deve ser igual ou posterior ao início.
        </p>
      )}
    </div>
  )
}
