import { FilterLink as Link } from '../../../components/filters/FilterLink'
import { buttonClass } from '../../appointments/components/Selectors'
import { examDate, lateralityLabels } from '../lib/exam'
import type { ExamSummary } from '../types/exam'
import { ExamStatusBadge } from './ExamStatusBadge'
export function ExamList({ exams }: { exams: ExamSummary[] }) {
  return (
    <>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:hidden">
        {exams.map((exam) => (
          <article
            key={exam.id}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4"
          >
            <header className="space-y-2">
              <h2 className="break-words text-lg font-semibold">{exam.examType.name}</h2>
              <ExamStatusBadge status={exam.status} />
            </header>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-text-secondary">Paciente</dt>
                <dd>{exam.patient.name}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Lateralidade</dt>
                <dd>{lateralityLabels[exam.laterality]}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Solicitação</dt>
                <dd>{examDate(exam.requestedAt)}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Solicitante</dt>
                <dd>{exam.requestedByProfessional.user.name}</dd>
              </div>
            </dl>
            <Link
              className={`${buttonClass} w-full`}
              to={`/exames/${exam.id}`}
              aria-label={`Abrir exame ${exam.examType.name} de ${exam.patient.name}`}
            >
              Abrir exame
            </Link>
          </article>
        ))}
      </div>
      <div className="hidden rounded-xl border border-border bg-white xl:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Exames solicitados por você nesta clínica</caption>
          <thead className="border-b border-border bg-background">
            <tr>
              {[
                'Paciente / solicitante',
                'Exame / lateralidade',
                'Solicitação',
                'Status',
                'Ações',
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="p-4 font-semibold"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr
                key={exam.id}
                className="border-b border-border last:border-0"
              >
                <td className="break-words p-4">
                  {exam.patient.name}
                  <span className="mt-1 block text-xs text-text-secondary">
                    {exam.requestedByProfessional.user.name}
                  </span>
                </td>
                <td className="break-words p-4">
                  {exam.examType.name}
                  <span className="mt-1 block text-xs text-text-secondary">
                    {lateralityLabels[exam.laterality]}
                  </span>
                </td>
                <td className="p-4">{examDate(exam.requestedAt)}</td>
                <td className="p-4">
                  <ExamStatusBadge status={exam.status} />
                </td>
                <td className="p-4">
                  <Link
                    to={`/exames/${exam.id}`}
                    className={buttonClass}
                    aria-label={`Abrir exame ${exam.examType.name} de ${exam.patient.name}`}
                  >
                    Abrir exame
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
