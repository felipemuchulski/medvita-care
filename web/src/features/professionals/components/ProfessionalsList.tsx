import { useState } from 'react'
import { Link } from 'react-router'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { useProfessionals } from '../hooks/use-professionals'
import { professionalError, searchProfessionals, states } from '../lib/professional'

export function ProfessionalsList({
  clinic,
  manage,
  ownUser,
}: {
  clinic: string
  manage: boolean
  ownUser?: string
}) {
  const query = useProfessionals(clinic)
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const profiles = (query.data ?? []).filter((p) => !ownUser || p.userId === ownUser)
  const rows = searchProfessionals(profiles, search, state)
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Profissionais</h1>
        {manage && (
          <Link
            className={buttonClass}
            to="/profissionais/novo"
          >
            Cadastrar profissional
          </Link>
        )}
      </header>
      <section
        aria-label="Pesquisa e filtros de profissionais"
        className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2"
      >
        <label className="min-w-0 space-y-2">
          <span className="block font-medium">Pesquisar profissional</span>
          <input
            type="search"
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, CRM, RQE ou especialidade"
          />
        </label>
        <label className="min-w-0 space-y-2">
          <span className="block font-medium">UF do CRM</span>
          <select
            className={inputClass}
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Todas</option>
            {states.map((s) => (
              <option
                key={s}
                value={s}
              >
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${buttonClass} justify-self-start`}
          onClick={() => {
            setSearch('')
            setState('')
          }}
        >
          Limpar filtros
        </button>
      </section>
      {query.isPending ? (
        <p role="status">Carregando profissionais...</p>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg bg-red-50 p-4 text-red-900"
        >
          <p>{professionalError(query.error)}</p>
          <button
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <p
            role="status"
            className="text-sm text-text-secondary"
          >
            {rows.length} profissional(is) encontrado(s) na clínica.
          </p>
          {!rows.length ? (
            <p className="rounded-xl border border-dashed border-border p-6">
              Nenhum profissional encontrado. Ajuste a busca ou verifique os vínculos
              ativos da clínica.
            </p>
          ) : (
            <>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:hidden">
                {rows.map((p) => (
                  <article
                    key={p.id}
                    className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4 [overflow-wrap:anywhere]"
                  >
                    <h2 className="text-lg font-semibold">{p.user.name}</h2>
                    <p>
                      CRM {p.crm}/{p.crmState}
                    </p>
                    <p>RQE: {p.rqe || 'Não informado'}</p>
                    <p>{p.specialty}</p>
                    <Link
                      className={`${buttonClass} w-full`}
                      to={`/profissionais/${p.id}`}
                    >
                      Ver detalhes
                    </Link>
                    {manage && (
                      <Link
                        className={`${buttonClass} w-full`}
                        to={`/profissionais/${p.id}/editar`}
                      >
                        Editar
                      </Link>
                    )}
                  </article>
                ))}
              </div>
              <div className="hidden rounded-xl border border-border bg-white lg:block">
                <table className="w-full table-fixed text-left">
                  <thead>
                    <tr>
                      {['Nome', 'CRM/UF', 'RQE', 'Especialidade', 'Ações'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="p-3"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-border"
                      >
                        <td className="p-3 [overflow-wrap:anywhere]">{p.user.name}</td>
                        <td className="p-3 [overflow-wrap:anywhere]">
                          {p.crm}/{p.crmState}
                        </td>
                        <td className="p-3 [overflow-wrap:anywhere]">
                          {p.rqe || 'Não informado'}
                        </td>
                        <td className="p-3 [overflow-wrap:anywhere]">{p.specialty}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              className={buttonClass}
                              to={`/profissionais/${p.id}`}
                            >
                              Detalhes
                            </Link>
                            {manage && (
                              <Link
                                className={buttonClass}
                                to={`/profissionais/${p.id}/editar`}
                              >
                                Editar
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
