import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { useClinics, useClinicDetails } from '../hooks/use-clinics'
import { canEditClinic, clinicError, normalizeClinicDocument } from '../lib/clinic'
import { ClinicList } from '../components/ClinicList'
import { ClinicForm } from '../components/ClinicForm'
import { ClinicDetails } from '../components/ClinicDetails'
import type { Clinic } from '../types/clinic'

export default function ClinicsPage() {
  const { user } = useAuth()
  const context = useClinic()
  const { clinicId } = useParams()
  const location = useLocation()
  const create = location.pathname === '/clinicas/nova'
  const editing = location.pathname.endsWith('/editar')
  const mine =
    location.pathname === '/minha-clinica' ||
    (!user?.isSystemAdmin && !clinicId && !create)
  const id = mine ? context.activeClinicId : clinicId
  const role = context.memberships.find((m) => m.clinicId === id)?.role
  const system = Boolean(user?.isSystemAdmin)
  const title = create
    ? 'Cadastrar clínica'
    : editing
      ? 'Editar clínica'
      : mine
        ? 'Minha clínica'
        : id
          ? 'Detalhes da clínica'
          : 'Clínicas'
  let content
  if (!user) content = <p role="alert">Entre na sua conta para acessar clínicas.</p>
  else if (!system && (context.isLoading || context.error))
    content = context.isLoading ? (
      <p role="status">Carregando vínculos...</p>
    ) : (
      <p role="alert">{context.error}</p>
    )
  else if (create && !system)
    content = (
      <p role="alert">Somente administradores do sistema podem cadastrar clínicas.</p>
    )
  else if (mine && !id)
    content = (
      <p role="status">
        Selecione uma clínica com vínculo ativo no menu. O cadastro global não concede
        vínculo automático com a equipe.
      </p>
    )
  else if (id && !system && !role)
    content = (
      <p role="alert">Você não possui vínculo ativo autorizado com esta clínica.</p>
    )
  else if (editing && !canEditClinic(system, role))
    content = <p role="alert">Você não tem permissão para editar esta clínica.</p>
  else if (create) content = <FormScreen user={user.id} />
  else if (id)
    content = (
      <Detail
        key={`${user.id}:${id}:${editing}:${system ? 'global' : role}`}
        user={user.id}
        id={id}
        system={system}
        edit={canEditClinic(system, role)}
        editing={editing}
      />
    )
  else if (system) content = <GlobalList user={user.id} />
  else content = <p role="alert">Acesso indisponível.</p>
  return (
    <div className="min-w-0 space-y-5 break-words [&_button]:min-h-11 [&_button]:min-w-11 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-primary">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-text-secondary">
          {system && !mine
            ? 'Administre o cadastro e a situação das clínicas.'
            : 'Consulte os dados da clínica e as ações disponíveis para seu vínculo.'}
        </p>
      </header>
      {content}
    </div>
  )
}
function Detail({
  user,
  id,
  system,
  edit,
  editing,
}: {
  user: string
  id: string
  system: boolean
  edit: boolean
  editing: boolean
}) {
  const query = useClinicDetails(user, id)
  const location = useLocation()
  if (query.isPending) return <p role="status">Carregando clínica...</p>
  if (query.isError)
    return (
      <div
        role="alert"
        className="space-y-3"
      >
        <p>{clinicError(query.error)}</p>
        <button
          className={buttonClass}
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </button>
        <Link
          to="/clinicas"
          className={buttonClass}
        >
          Voltar
        </Link>
      </div>
    )
  if (editing)
    return (
      <FormScreen
        user={user}
        clinic={query.data}
      />
    )
  return (
    <ClinicDetails
      clinic={query.data}
      user={user}
      system={system}
      edit={edit}
      notice={location.state?.clinicSaved ? 'Cadastro salvo com sucesso.' : undefined}
    />
  )
}
function FormScreen({ user, clinic }: { user: string; clinic?: Clinic }) {
  const [saved, setSaved] = useState<Clinic | null>(null)
  if (saved)
    return (
      <Navigate
        to={`/clinicas/${saved.id}`}
        replace
        state={{ clinicSaved: true }}
      />
    )
  return (
    <ClinicForm
      user={user}
      clinic={clinic}
      onSaved={setSaved}
      back={clinic ? `/clinicas/${clinic.id}` : '/clinicas'}
    />
  )
}
function GlobalList({ user }: { user: string }) {
  const query = useClinics(user)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSearch(String(data.get('search') || '').trim())
    setStatus(String(data.get('status') || ''))
    setPage(1)
  }
  const term = search.toLocaleLowerCase('pt-BR')
  const document = normalizeClinicDocument(search)
  const filtered = (query.data || []).filter(
    (clinic) =>
      (!status || clinic.active === (status === 'active')) &&
      (!search ||
        clinic.name.toLocaleLowerCase('pt-BR').includes(term) ||
        clinic.email?.toLocaleLowerCase('pt-BR').includes(term) ||
        (document && clinic.document.includes(document))),
  )
  const totalPages = Math.ceil(filtered.length / 20)
  const currentPage = Math.min(page, Math.max(1, totalPages))
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/clinicas/nova"
          className={buttonClass}
        >
          Cadastrar clínica
        </Link>
        <Link
          to="/minha-clinica"
          className={buttonClass}
        >
          Minha clínica
        </Link>
      </div>
      <form
        onSubmit={filter}
        className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Filtros de clínicas"
      >
        <div className="form-field">
          <label
            htmlFor="clinics-search"
            className="text-sm font-medium"
          >
            Buscar por nome, documento ou e-mail
          </label>
          <input
            id="clinics-search"
            name="search"
            type="search"
            className={inputClass}
            maxLength={150}
          />
        </div>
        <div className="form-field">
          <label
            htmlFor="clinics-status"
            className="text-sm font-medium"
          >
            Situação cadastral
          </label>
          <select
            id="clinics-status"
            name="status"
            className={inputClass}
          >
            <option value="">Todas</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="submit"
            className={buttonClass}
          >
            Aplicar filtros
          </button>
          <button
            type="reset"
            className={buttonClass}
            onClick={() => {
              setSearch('')
              setStatus('')
              setPage(1)
            }}
          >
            Limpar filtros
          </button>
        </div>
      </form>
      {query.isPending ? (
        <p role="status">Carregando clínicas...</p>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3"
        >
          <p>{clinicError(query.error)}</p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : !filtered.length ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-border bg-white p-6"
        >
          Nenhuma clínica encontrada para os filtros selecionados.
        </p>
      ) : (
        <ClinicList clinics={filtered.slice((currentPage - 1) * 20, currentPage * 20)} />
      )}
      {!query.isError && totalPages > 1 && (
        <nav
          aria-label="Paginação de clínicas"
          className="flex flex-wrap items-center gap-3"
        >
          <button
            type="button"
            className={buttonClass}
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <p className="text-sm">
            Página {currentPage} de {totalPages}
          </p>
          <button
            type="button"
            className={buttonClass}
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  )
}
