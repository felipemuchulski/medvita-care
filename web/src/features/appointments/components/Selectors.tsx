import { useAuthorizedQuery } from '../../../lib/authorized-query'
import { useId, useState, type Ref } from 'react'
import { patientsApi } from '../../patients/api/patients-api'
import { SearchField } from '../../../components/filters/SearchField'
import { useProfessionals } from '../../professionals/hooks/use-professionals'

export const inputClass =
  'h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-base'
export const buttonClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-primary px-4 py-2 text-primary font-medium disabled:opacity-50'
export const compactButtonClass =
  'inline-flex h-[30px] min-w-[30px] shrink-0 items-center justify-center self-center rounded-lg border border-primary px-3 py-0 text-sm font-medium text-primary disabled:opacity-50'

export function PatientSelector({
  clinic,
  value,
  onChange,
  activeOnly = false,
  invalid = false,
  describedBy,
  selectRef,
  searchValue,
  onSearchChange,
}: {
  clinic: string
  value: string
  onChange: (id: string) => void
  activeOnly?: boolean
  invalid?: boolean
  describedBy?: string
  selectRef?: Ref<HTMLSelectElement>
  searchValue?: string
  onSearchChange?: (value: string) => void
}) {
  const patientId = useId()
  const [selectedLabel, setSelectedLabel] = useState('')
  const [localSearch, setSearch] = useState('')
  const search = searchValue ?? localSearch
  const [page, setPage] = useState(1)
  const query = useAuthorizedQuery({
    queryKey: ['appointment-patients', clinic, search, page, activeOnly],
    queryFn: ({ signal }) =>
      patientsApi.list(
        clinic,
        {
          search,
          page,
          limit: 10,
          active: activeOnly ? true : undefined,
        },
        signal,
      ),
  })
  return (
    <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
      <SearchField
        label="Buscar paciente por nome ou CPF"
        value={search}
        onChange={(value) => {
          if (onSearchChange) onSearchChange(value)
          else setSearch(value)
          setPage(1)
        }}
      />
      <div className="form-field">
        <label
          htmlFor={patientId}
          className="block font-medium"
        >
          Paciente
        </label>
        <select
          id={patientId}
          aria-label="Paciente"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          ref={selectRef}
          className={inputClass}
          value={value}
          onChange={(e) => {
            setSelectedLabel(e.target.selectedOptions[0].text)
            onChange(e.target.value)
          }}
        >
          {value && !query.data?.data.some((p) => p.id === value) && (
            <option value={value}>{selectedLabel || 'Paciente selecionado'}</option>
          )}
          <option value="">
            {query.isLoading ? 'Carregando...' : 'Selecione um paciente'}
          </option>
          {query.data?.data.map((p) => (
            <option
              key={p.id}
              value={p.id}
            >
              {p.name} · nasc. {p.birthDate.split('-').reverse().join('/')}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {query.isError && (
          <p role="alert">
            Falha ao buscar pacientes.{' '}
            <button
              type="button"
              className={buttonClass}
              onClick={() => void query.refetch()}
            >
              Tentar novamente
            </button>
          </p>
        )}
        {query.data?.data.length === 0 && <p>Nenhum paciente encontrado.</p>}
        <div className="flex flex-wrap gap-2">
          {query.data && query.data.meta.totalPages > 1 && (
            <>
              <button
                type="button"
                className={compactButtonClass}
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className={compactButtonClass}
                disabled={
                  !query.data || page >= query.data.meta.totalPages || query.isFetching
                }
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </>
          )}
          {value && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => onChange('')}
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
export function ProfessionalSelector({
  clinic,
  value,
  onChange,
}: {
  clinic: string
  value: string
  onChange: (id: string) => void
}) {
  const professionalId = useId()
  const query = useProfessionals(clinic)
  return (
    <div className="form-field md:col-span-2">
      <label
        htmlFor={professionalId}
        className="block font-medium"
      >
        Profissional
      </label>
      <select
        id={professionalId}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {query.isLoading ? 'Carregando...' : 'Selecione um profissional'}
        </option>
        {query.data?.map((p) => (
          <option
            key={p.id}
            value={p.id}
          >
            {p.user.name} · CRM {p.crm}/{p.crmState}
          </option>
        ))}
      </select>
      {query.isError && (
        <span role="alert">
          Falha ao buscar profissionais.{' '}
          <button
            type="button"
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </span>
      )}
      {query.data?.length === 0 && <span>Nenhum profissional ativo nesta clínica.</span>}
    </div>
  )
}
