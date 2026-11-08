import { Link } from 'react-router'
import { buttonClass } from '../../appointments/components/Selectors'
import type { Clinic } from '../types/clinic'
import { formatClinicDocument } from '../lib/clinic'
import { ClinicStatusBadge } from './ClinicStatusBadge'
export function ClinicList({ clinics }: { clinics: Clinic[] }) {
  return (
    <>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:hidden">
        {clinics.map((clinic) => (
          <article
            key={clinic.id}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4"
          >
            <h2 className="break-words text-lg font-semibold">{clinic.name}</h2>
            <ClinicStatusBadge active={clinic.active} />
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-text-secondary">Documento</dt>
                <dd>{formatClinicDocument(clinic.document)}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">E-mail</dt>
                <dd className="[overflow-wrap:anywhere]">
                  {clinic.email || 'Não informado'}
                </dd>
              </div>
            </dl>
            <Link
              className={`${buttonClass} w-full`}
              to={`/clinicas/${clinic.id}`}
              aria-label={`Abrir clínica ${clinic.name}`}
            >
              Abrir clínica
            </Link>
          </article>
        ))}
      </div>
      <div className="hidden rounded-xl border border-border bg-white xl:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Clínicas cadastradas</caption>
          <thead className="border-b border-border bg-background">
            <tr>
              {['Clínica', 'Documento', 'E-mail', 'Status', 'Ações'].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="p-4"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clinics.map((clinic) => (
              <tr
                key={clinic.id}
                className="border-b border-border last:border-0"
              >
                <td className="break-words p-4 font-medium">{clinic.name}</td>
                <td className="p-4">{formatClinicDocument(clinic.document)}</td>
                <td className="p-4 [overflow-wrap:anywhere]">
                  {clinic.email || 'Não informado'}
                </td>
                <td className="p-4">
                  <ClinicStatusBadge active={clinic.active} />
                </td>
                <td className="p-4">
                  <Link
                    className={buttonClass}
                    to={`/clinicas/${clinic.id}`}
                    aria-label={`Abrir clínica ${clinic.name}`}
                  >
                    Abrir clínica
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
