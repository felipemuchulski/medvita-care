import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import type { ExamValues } from '../schemas/exam'
import type { ExamType } from '../types/exam'
import { ExamField } from './ExamField'
import { ExamFilters } from './ExamFilters'
import { ExamRequestFields } from './ExamRequestFields'

// Visual examples only. These identifiers never leave this component.
const previewTypes: ExamType[] = [
  ['OCT', 'Tomografia de Coerência Óptica (OCT)'],
  ['CAMPIMETRY', 'Campimetria'],
  ['CORNEAL_TOPOGRAPHY', 'Topografia corneana'],
  ['PACHYMETRY', 'Paquimetria'],
  ['BIOMETRY', 'Biometria'],
  ['RETINOGRAPHY', 'Retinografia'],
].map(([code, name]) => ({ id: `preview-${code}`, code, name, isActive: true }))

export default function ExamDesignPreview() {
  const [view, setView] = useState<'list' | 'request' | 'result'>('list')
  const [resetKey, setResetKey] = useState(0)
  const [filters, setFilters] = useState(new URLSearchParams())
  const {
    register,
    formState: { errors },
  } = useForm<ExamValues>({
    defaultValues: {
      patientId: '',
      encounterId: '',
      examTypeId: '',
      laterality: 'AO',
      notes: '',
    },
  })

  return (
    <div className="min-w-0 space-y-5 break-words [&_button]:min-h-11 [&_button]:min-w-11 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary">
      <h1 className="text-2xl font-bold">Exames</h1>

      <aside className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <h2 className="font-semibold">Prévia visual · somente desenvolvimento</h2>
        <p className="text-sm">
          Acesso administrativo para validar o design. Nenhum exame ou paciente real é
          consultado. Você pode testar os campos; salvar, concluir e cancelar estão
          desabilitados. O conteúdo digitado é descartado ao sair.
        </p>
      </aside>

      <div
        className="flex flex-wrap gap-3"
        aria-label="Áreas da prévia de exames"
      >
        {(
          [
            ['list', 'Listagem e filtros'],
            ['request', 'Solicitação de exame'],
            ['result', 'Registro do resultado'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={buttonClass}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <>
          <ExamFilters
            resetKey={resetKey}
            values={Object.fromEntries(filters)}
            types={previewTypes}
            onChange={(patch) =>
              setFilters((previous) => {
                const next = new URLSearchParams(previous)
                for (const [key, value] of Object.entries(patch)) {
                  if (value) next.set(key, value)
                  else next.delete(key)
                }
                return next
              })
            }
            onClear={() => {
              setFilters(new URLSearchParams())
              setResetKey((key) => key + 1)
            }}
          />
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-text-secondary">
            Nenhum dado clínico é carregado nesta prévia. Abra “Solicitação de exame” ou
            “Registro do resultado” para validar os campos. Os tipos exibidos são exemplos
            visuais.
          </p>
        </>
      )}

      <form
        hidden={view !== 'request'}
        onSubmit={(event) => event.preventDefault()}
        className="space-y-5"
        aria-label="Prévia da solicitação de exame"
      >
        <section className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Paciente e atendimento</h2>
          <ExamField
            id="preview-patient"
            label="Paciente · prévia"
          >
            <input
              id="preview-patient"
              className={inputClass}
              disabled
              placeholder="Seleção indisponível nesta prévia"
            />
          </ExamField>
          <ExamField
            id="preview-encounter"
            label="Atendimento associado (opcional)"
          >
            <select
              id="preview-encounter"
              className={inputClass}
              disabled
            >
              <option>Sem atendimento associado</option>
            </select>
          </ExamField>
        </section>
        <section className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 sm:p-6">
          <h2 className="text-lg font-semibold sm:col-span-2">Informações do exame</h2>
          <ExamRequestFields
            register={register}
            errors={errors}
            types={previewTypes}
          />
        </section>
        <button
          type="button"
          className={buttonClass}
          disabled
        >
          Solicitar exame · indisponível na prévia
        </button>
      </form>

      <form
        hidden={view !== 'result'}
        onSubmit={(event) => event.preventDefault()}
        className="space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
        aria-label="Prévia do registro de resultado"
      >
        <h2 className="text-lg font-semibold">Registrar resultado</h2>
        <ExamField
          id="preview-performed"
          label="Data e horário de realização (UTC−03:00)"
        >
          <input
            id="preview-performed"
            type="datetime-local"
            step="1"
            className={inputClass}
          />
        </ExamField>
        <ExamField
          id="preview-result"
          label="Resultado descritivo"
        >
          <textarea
            id="preview-result"
            rows={8}
            maxLength={12000}
            className={`${inputClass} h-auto min-h-40 resize-y`}
          />
        </ExamField>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className={buttonClass}
            disabled
          >
            Salvar resultado
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled
          >
            Concluir exame
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled
          >
            Cancelar exame
          </button>
        </div>
      </form>
    </div>
  )
}
