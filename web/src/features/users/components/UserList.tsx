import { Link } from 'react-router'
import { buttonClass } from '../../appointments/components/Selectors'
import type { ManagedUser } from '../types/user'
import { UserStatusBadge } from './UserStatusBadge'
export function UserList({ users }: { users: ManagedUser[] }) {
  return (
    <>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:hidden">
        {users.map((user) => (
          <article
            key={user.id}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-white p-4"
          >
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="text-sm [overflow-wrap:anywhere]">{user.email}</p>
            <UserStatusBadge active={user.active} />
            {user.isSystemAdmin && (
              <p className="text-sm text-text-secondary">Administrador do sistema</p>
            )}
            <Link
              className={`${buttonClass} w-full`}
              to={`/usuarios/${user.id}`}
              aria-label={`Abrir usuário ${user.name}`}
            >
              Abrir usuário
            </Link>
          </article>
        ))}
      </div>
      <div className="hidden rounded-xl border border-border bg-white xl:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Usuários globais autorizados</caption>
          <thead className="border-b border-border bg-background">
            <tr>
              {['Nome', 'E-mail', 'Conta', 'Acesso global', 'Ações'].map((label) => (
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
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border last:border-0"
              >
                <td className="break-words p-4">{user.name}</td>
                <td className="p-4 [overflow-wrap:anywhere]">{user.email}</td>
                <td className="p-4">
                  <UserStatusBadge active={user.active} />
                </td>
                <td className="p-4">
                  {user.isSystemAdmin ? 'Administrador do sistema' : 'Usuário'}
                </td>
                <td className="p-4">
                  <Link
                    className={buttonClass}
                    to={`/usuarios/${user.id}`}
                    aria-label={`Abrir usuário ${user.name}`}
                  >
                    Abrir usuário
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
