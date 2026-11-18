import { textFields, formatPressure } from '../lib/encounter'
import type { Encounter } from '../types/encounter'
export function ClinicalReadOnly({ encounter }: { encounter: Encounter }) {
  return (
    <section
      className="space-y-5 rounded-xl border border-border bg-white p-4 sm:p-6"
      aria-label="Dados clínicos em modo somente leitura"
    >
      <h2 className="text-lg font-semibold">Registro clínico · somente leitura</h2>
      <dl className="space-y-4">
        {textFields.map((field) => (
          <div key={field.name}>
            <dt className="font-medium">{field.label}</dt>
            <dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">
              {encounter[field.name] || 'Não informado'}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {(['Right', 'Left'] as const).map((side) => (
          <section
            key={side}
            className="min-w-0 rounded-lg border border-border p-3"
          >
            <h3 className="font-medium">
              {side === 'Right' ? 'Olho direito (OD)' : 'Olho esquerdo (OS)'}
            </h3>
            <p className="mt-2 [overflow-wrap:anywhere]">
              Acuidade visual: {encounter[`visualAcuity${side}`] || 'Não informada'}
            </p>
            <p className="[overflow-wrap:anywhere]">
              Pressão intraocular:{' '}
              {formatPressure(encounter[`intraocularPressure${side}`])}
            </p>
          </section>
        ))}
      </div>
      {encounter.cancellationReason && (
        <div>
          <h3 className="font-medium">Motivo do cancelamento</h3>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {encounter.cancellationReason}
          </p>
        </div>
      )}
    </section>
  )
}
