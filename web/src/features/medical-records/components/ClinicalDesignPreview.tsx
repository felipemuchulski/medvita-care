import { useState } from 'react'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { encounterLabels } from '../lib/encounter'
import { EncounterForm } from './EncounterForm'

const emptyRecord = {
  id: 'design-preview',
  patient: { name: 'Prévia visual — nenhum paciente selecionado' },
  chiefComplaint: null,
  anamnesis: null,
  visualAcuityRight: null,
  visualAcuityLeft: null,
  intraocularPressureRight: null,
  intraocularPressureLeft: null,
  clinicalAssessment: null,
  plan: null,
  clinicalNotes: null,
}

export default function ClinicalDesignPreview() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  return (
    <div className="min-w-0 space-y-5">
      <h1 className="text-2xl font-bold">Prontuários oftalmológicos</h1>

      <aside className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <h2 className="font-semibold">Prévia visual · somente desenvolvimento</h2>
        <p className="text-sm">
          Acesso administrativo para ajustes de design. Nenhum prontuário real é
          consultado. Você pode testar os campos; salvar, concluir e cancelar estão
          desabilitados. O conteúdo digitado é descartado ao sair.
        </p>
      </aside>

      <div
        className="flex flex-wrap gap-3"
        aria-label="Áreas da prévia"
      >
        <button
          type="button"
          className={buttonClass}
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          Listagem e filtros
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-pressed={view === 'form'}
          onClick={() => setView('form')}
        >
          Formulário clínico
        </button>
      </div>

      {view === 'list' ? (
        <>
          <section
            aria-label="Filtros de prontuários em prévia"
            className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2"
          >
            <label className="form-field">
              <span>Pesquisar paciente · prévia</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={inputClass}
                placeholder="Busca desativada nesta prévia"
              />
            </label>
            <label className="form-field">
              <span>Status do atendimento</span>
              <select
                aria-label="Status do atendimento"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={inputClass}
              >
                <option value="">Todos</option>
                {Object.entries(encounterLabels).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`${buttonClass} justify-self-start`}
              onClick={() => {
                setSearch('')
                setStatus('')
              }}
            >
              Limpar filtros
            </button>
          </section>
          <p className="rounded-xl border border-dashed border-border p-6">
            Nenhum dado clínico é carregado nesta prévia. Abra “Formulário clínico” para
            ajustar o layout dos campos.
          </p>
        </>
      ) : (
        <EncounterForm
          encounter={emptyRecord}
          clinic="design-preview"
          user="design-preview"
          preview
        />
      )}
    </div>
  )
}
