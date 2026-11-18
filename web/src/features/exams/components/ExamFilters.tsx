import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { SearchField } from '../../../components/filters/SearchField'
import { PeriodFields } from '../../../components/filters/PeriodFields'
import { examStatusLabels } from '../lib/exam'
import type { ExamType } from '../types/exam'
export function ExamFilters({
  values,
  types,
  onChange,
  onClear,
  resetKey,
}: {
  values: Record<string, string>
  types: ExamType[]
  onChange: (patch: Record<string, string>, replace?: boolean) => void
  onClear: () => void
  resetKey: number
}) {
  return (
    <section
      className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Filtros de exames"
    >
      <SearchField
        key={resetKey}
        label="Buscar paciente ou tipo de exame"
        value={values.search || ''}
        onChange={(search) => onChange({ search }, true)}
      />
      <label className="form-field min-w-0">
        <span>Tipo de exame</span>
        <select
          value={values.examTypeId || ''}
          onChange={(event) => onChange({ examTypeId: event.target.value })}
          className={inputClass}
        >
          <option value="">Todos</option>
          {types.map((type) => (
            <option
              key={type.id}
              value={type.id}
            >
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field min-w-0">
        <span>Status</span>
        <select
          value={values.status || ''}
          onChange={(event) => onChange({ status: event.target.value })}
          className={inputClass}
        >
          <option value="">Todos</option>
          {Object.entries(examStatusLabels).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <PeriodFields
          from={values.from || ''}
          to={values.to || ''}
          onChange={onChange}
        />
      </div>
      <button
        className={`${buttonClass} justify-self-start`}
        type="button"
        onClick={onClear}
      >
        Limpar filtros
      </button>
    </section>
  )
}
