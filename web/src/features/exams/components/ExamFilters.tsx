import { useState, type FormEvent } from 'react'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { examStatusLabels } from '../lib/exam'
import type { ExamType } from '../types/exam'
import { ExamField } from './ExamField'
export function ExamFilters({
  params,
  types,
  onApply,
}: {
  params: URLSearchParams
  types: ExamType[]
  onApply: (params: URLSearchParams) => void
}) {
  const [error, setError] = useState('')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const from = String(data.get('from') || '')
    const to = String(data.get('to') || '')
    if (from && to && from > to) {
      setError('O fim do período deve ser igual ou posterior ao início.')
      return
    }
    setError('')
    const next = new URLSearchParams(params)
    for (const field of ['search', 'examTypeId', 'status', 'from', 'to']) {
      const value = String(data.get(field) || '').trim()
      if (value) next.set(field, value)
      else next.delete(field)
    }
    next.delete('page')
    onApply(next)
  }
  return (
    <form
      onSubmit={submit}
      className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Filtros de exames"
    >
      <ExamField
        id="exams-search"
        label="Buscar paciente ou tipo de exame"
      >
        <input
          id="exams-search"
          name="search"
          type="search"
          maxLength={150}
          defaultValue={params.get('search') || ''}
          className={inputClass}
        />
      </ExamField>
      <ExamField
        id="exams-type"
        label="Tipo de exame"
      >
        <select
          id="exams-type"
          name="examTypeId"
          defaultValue={params.get('examTypeId') || ''}
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
      </ExamField>
      <ExamField
        id="exams-status"
        label="Status"
      >
        <select
          id="exams-status"
          name="status"
          defaultValue={params.get('status') || ''}
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
      </ExamField>
      <ExamField
        id="exams-from"
        label="Solicitados de"
      >
        <input
          id="exams-from"
          name="from"
          type="date"
          defaultValue={params.get('from') || ''}
          className={inputClass}
        />
      </ExamField>
      <ExamField
        id="exams-to"
        label="Solicitados até"
      >
        <input
          id="exams-to"
          name="to"
          type="date"
          defaultValue={params.get('to') || ''}
          className={inputClass}
        />
      </ExamField>
      <div className="flex flex-wrap items-end gap-3">
        <button
          className={buttonClass}
          type="submit"
        >
          Aplicar filtros
        </button>
        <button
          className={buttonClass}
          type="button"
          onClick={() => onApply(new URLSearchParams())}
        >
          Limpar filtros
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="text-sm text-red-800 sm:col-span-2 lg:col-span-3"
        >
          {error}
        </p>
      )}
    </form>
  )
}
