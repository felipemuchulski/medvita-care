import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { patientsApi } from '../../patients/api/patients-api'
import { appointmentsApi } from '../api/appointments-api'
export const inputClass = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-base'
export const buttonClass = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-primary px-4 py-2 text-primary font-medium disabled:opacity-50'
export function PatientSelector({clinic, value, onChange, activeOnly = false}: {clinic: string; value: string; onChange: (id: string) => void; activeOnly?: boolean}) {
  const [selectedLabel, setSelectedLabel] = useState('')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const query = useQuery({queryKey: ['appointment-patients', clinic, search, page, activeOnly], queryFn: () => patientsApi.list(clinic, {search, page, limit: 10, active: activeOnly ? true : undefined})})
  return <fieldset className="min-w-0 space-y-2"><legend className="font-medium">Paciente</legend><div className="flex gap-2"><input aria-label="Pesquisar paciente por nome ou CPF" className={inputClass} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Nome ou CPF" /><button type="button" className={buttonClass} onClick={() => {setSearch(draft.trim()); setPage(1)}}>Buscar</button></div>
    {value && <p className="text-sm" role="status">{selectedLabel || 'Paciente selecionado'}. A pesquisa só altera a seleção ao escolher outro paciente.</p>}
    <select aria-label="Paciente" className={inputClass} value={value} onChange={e => {setSelectedLabel(e.target.selectedOptions[0].text); onChange(e.target.value)}}>{value && !query.data?.data.some(p => p.id === value) && <option value={value}>{selectedLabel || 'Paciente selecionado'}</option>}<option value="">{query.isLoading ? 'Carregando...' : 'Selecione um paciente'}</option>{query.data?.data.map(p => <option key={p.id} value={p.id}>{p.name} · nasc. {p.birthDate.split('-').reverse().join('/')}</option>)}</select>
    {query.isError && <p role="alert">Falha ao buscar pacientes. <button type="button" className={buttonClass} onClick={() => void query.refetch()}>Tentar novamente</button></p>}
    {query.data?.data.length === 0 && <p>Nenhum paciente encontrado.</p>}
    <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={page === 1 || query.isFetching} onClick={() => setPage(p => p-1)}>Anterior</button><button type="button" className={buttonClass} disabled={!query.data || page >= query.data.meta.totalPages || query.isFetching} onClick={() => setPage(p => p+1)}>Próxima</button>{value && <button type="button" className={buttonClass} onClick={() => onChange('')}>Limpar</button>}</div>
  </fieldset>
}
export function ProfessionalSelector({clinic, value, onChange}: {clinic: string; value: string; onChange: (id: string) => void}) {
  const query = useQuery({queryKey: ['appointment-professionals', clinic], queryFn: ({signal}) => appointmentsApi.professionals(clinic, signal)})
  return <label className="block min-w-0 space-y-2"><span className="font-medium">Profissional</span><select className={inputClass} value={value} onChange={e => onChange(e.target.value)}><option value="">{query.isLoading ? 'Carregando...' : 'Selecione um profissional'}</option>{query.data?.map(p => <option key={p.id} value={p.id}>{p.user.name} · CRM {p.crm}/{p.crmState}</option>)}</select>{query.isError && <span role="alert">Falha ao buscar profissionais. <button type="button" className={buttonClass} onClick={() => void query.refetch()}>Tentar novamente</button></span>}{query.data?.length === 0 && <span>Nenhum profissional ativo nesta clínica.</span>}</label>
}
