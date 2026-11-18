import { useNavigationNotice } from '../../../hooks/use-navigation-notice'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useParams, useLocation } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { buttonClass, inputClass } from '../../appointments/components/Selectors'
import { useManagedUser, useUsers } from '../hooks/use-users'
import type { ManagedUser, UserQuery } from '../types/user'
import { userError } from '../lib/user'
import { UserList } from '../components/UserList'
import { UserForm } from '../components/UserForm'
import { UserDetails } from '../components/UserDetails'
export default function UsersPage() {
  const { user } = useAuth()
  const { userId } = useParams()
  const location = useLocation()
  const create = location.pathname === '/usuarios/novo'
  const edit = location.pathname.endsWith('/editar')
  return (
    <div className="min-w-0 space-y-5 break-words [&_button]:min-h-11 [&_button]:min-w-11 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-primary [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-primary">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">
          {create
            ? 'Cadastrar usuário'
            : edit
              ? 'Editar usuário'
              : userId
                ? 'Detalhes do usuário'
                : 'Usuários'}
        </h1>
        <p className="text-sm text-text-secondary">
          Administração de contas globais. Vínculos com clínicas e perfis profissionais
          são gerenciados separadamente.
        </p>
      </header>
      {!user?.isSystemAdmin ? (
        <p role="alert">
          A administração global de usuários é restrita ao administrador do sistema.
        </p>
      ) : create ? (
        <Form />
      ) : userId ? (
        <Detail
          key={`${user.id}:${userId}:${edit}`}
          actor={user.id}
          id={userId}
          edit={edit}
        />
      ) : (
        <List actor={user.id} />
      )}
    </div>
  )
}
function Form({ record }: { record?: ManagedUser }) {
  const [saved, setSaved] = useState<ManagedUser | null>(null)
  if (saved)
    return (
      <Navigate
        to={`/usuarios/${saved.id}`}
        replace
        state={{ userSaved: true }}
      />
    )
  return (
    <UserForm
      record={record}
      onSaved={setSaved}
    />
  )
}
function Detail({ actor, id, edit }: { actor: string; id: string; edit: boolean }) {
  const query = useManagedUser(actor, id)
  const notice = useNavigationNotice('userSaved', 'Usuário salvo com sucesso.')
  if (query.isPending) return <p role="status">Carregando usuário...</p>
  if (query.isError)
    return (
      <div
        role="alert"
        className="space-y-3"
      >
        <p>{userError(query.error)}</p>
        <button
          className={buttonClass}
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </button>
        <Link
          to="/usuarios"
          className={buttonClass}
        >
          Voltar
        </Link>
      </div>
    )
  return edit ? (
    <Form record={query.data} />
  ) : (
    <UserDetails
      actor={actor}
      record={query.data}
      notice={notice || undefined}
    />
  )
}
function List({ actor }: { actor: string }) {
  const [filters, setFilters] = useState<UserQuery>({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const query = useUsers(actor, filters)
  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') || '')
      .trim()
      .toLowerCase()
    const status = String(data.get('active') || '')
    setFilters({
      email: email || undefined,
      active: status ? status === 'true' : undefined,
    })
    setSearch(String(data.get('search') || '').trim())
    setPage(1)
  }
  const list = (query.data || []).filter(
    (user) =>
      !search ||
      user.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  )
  const total = Math.ceil(list.length / 20),
    current = Math.min(page, Math.max(1, total))
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/usuarios/novo"
          className={buttonClass}
        >
          Cadastrar usuário
        </Link>
        <Link
          to="/usuarios-clinica"
          className={buttonClass}
        >
          Equipe da clínica ativa
        </Link>
      </div>
      <form
        onSubmit={apply}
        className="grid min-w-0 gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Filtros de usuários"
      >
        <div className="form-field">
          <label
            htmlFor="users-search"
            className="text-sm font-medium"
          >
            Nome
          </label>
          <input
            id="users-search"
            name="search"
            type="search"
            className={inputClass}
            maxLength={150}
          />
        </div>
        <div className="form-field">
          <label
            htmlFor="users-email"
            className="text-sm font-medium"
          >
            E-mail exato
          </label>
          <input
            id="users-email"
            name="email"
            type="email"
            className={inputClass}
            maxLength={150}
          />
        </div>
        <div className="form-field">
          <label
            htmlFor="users-active"
            className="text-sm font-medium"
          >
            Status da conta
          </label>
          <select
            id="users-active"
            name="active"
            className={inputClass}
          >
            <option value="">Todos</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
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
              setFilters({})
              setSearch('')
              setPage(1)
            }}
          >
            Limpar filtros
          </button>
        </div>
      </form>
      {query.isPending ? (
        <p role="status">Carregando usuários...</p>
      ) : query.isError ? (
        <div
          role="alert"
          className="space-y-3"
        >
          <p>{userError(query.error)}</p>
          <button
            className={buttonClass}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : !list.length ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-border bg-white p-6"
        >
          Nenhum usuário encontrado para os filtros selecionados.
        </p>
      ) : (
        <UserList users={list.slice((current - 1) * 20, current * 20)} />
      )}
      {!query.isError && total > 1 && (
        <nav
          aria-label="Paginação de usuários"
          className="flex flex-wrap items-center gap-3"
        >
          <button
            className={buttonClass}
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </button>
          <p className="text-sm">
            Página {current} de {total}
          </p>
          <button
            className={buttonClass}
            disabled={current >= total}
            onClick={() => setPage(current + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  )
}
