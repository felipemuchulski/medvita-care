import { inputClass } from '../../appointments/components/Selectors'
import { calendarControl, viewLabels, type CalendarViewName } from '../types/calendar'
export function CalendarToolbar({
  title,
  date,
  view,
  desktop,
  onPrevious,
  onNext,
  onToday,
  onDate,
  onView,
}: {
  title: string
  date: string
  view: string
  desktop: boolean
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onDate: (date: string) => void
  onView: (view: CalendarViewName) => void
}) {
  return (
    <section
      aria-label="Navegação do calendário"
      className="space-y-3 rounded-xl border border-border bg-white p-4"
    >
      <h2
        aria-live="polite"
        className="break-words text-lg font-semibold first-letter:uppercase"
      >
        {title || 'Calendário'}
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          className={calendarControl}
          aria-label="Período anterior"
          onClick={onPrevious}
        >
          Anterior
        </button>
        <button
          type="button"
          className={calendarControl}
          onClick={onToday}
        >
          Hoje
        </button>
        <button
          type="button"
          className={calendarControl}
          aria-label="Próximo período"
          onClick={onNext}
        >
          Próximo
        </button>
        <label className="block min-w-0 max-w-full text-sm">
          Selecionar data
          <input
            aria-label="Selecionar data"
            type="date"
            value={date}
            className={`${inputClass} mt-1`}
            onChange={(e) => {
              if (e.target.value) onDate(e.target.value)
            }}
          />
        </label>
        <label className="block min-w-0 max-w-full text-sm">
          Visualização
          <select
            aria-label="Visualização"
            className={`${inputClass} mt-1`}
            value={view}
            onChange={(e) => onView(e.target.value as CalendarViewName)}
          >
            {Object.entries(viewLabels)
              .filter(([name]) => desktop || name !== 'timeGridWeek')
              .map(([name, label]) => (
                <option
                  key={name}
                  value={name}
                >
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
    </section>
  )
}
