import { Link } from 'react-router'
import { buttonClass } from '../../appointments/components/Selectors'
import { clinicRoleLabels } from '../../clinics/lib/clinic'
import type { ClinicTeamMember } from '../../clinics/types/clinic'
import { UserStatusBadge } from '../../users/components/UserStatusBadge'
import { ClinicUserActions } from './ClinicUserActions'
export function ClinicMemberList({
  members,
  clinic,
  actor,
  manage = false,
  system = false,
  clinicActive = true,
  selected,
}: {
  members: ClinicTeamMember[]
  clinic: string
  actor: string
  manage?: boolean
  system?: boolean
  clinicActive?: boolean
  selected?: string | null
}) {
  const actions = (member: ClinicTeamMember) => (
    <>
      {system && (
        <Link
          className={buttonClass}
          to={`/usuarios/${member.userId}`}
        >
          Abrir conta global
        </Link>
      )}
      {manage && (
        <ClinicUserActions
          clinic={clinic}
          member={member}
          clinicActive={clinicActive}
          actor={actor}
        />
      )}
    </>
  )
  return (
    <>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:hidden">
        {members.map((member) => (
          <article
            key={member.id}
            className={`min-w-0 space-y-3 rounded-xl border bg-white p-4 ${selected === member.userId ? 'border-primary' : 'border-border'}`}
          >
            <header className="space-y-2">
              <h3 className="text-lg font-semibold">
                {member.user?.name || 'Usuário não disponível'}
              </h3>
              <p className="text-sm [overflow-wrap:anywhere]">
                {member.user?.email || 'E-mail não informado'}
              </p>
            </header>
            <p className="text-sm">
              {clinicRoleLabels[member.role]} · Vínculo{' '}
              <UserStatusBadge active={member.active} />
            </p>
            <p className="text-sm text-text-secondary">
              Conta {member.user?.active ? 'ativa' : 'inativa'}
            </p>
            {actions(member)}
          </article>
        ))}
      </div>
      <div className="hidden rounded-xl border border-border bg-white xl:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Equipe vinculada à clínica</caption>
          <thead className="border-b border-border bg-background">
            <tr>
              {['Usuário', 'Papel', 'Vínculo / conta', 'Ações'].map((label) => (
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
            {members.map((member) => (
              <tr
                key={member.id}
                className={`border-b border-border last:border-0 ${selected === member.userId ? 'bg-primary-light' : ''}`}
              >
                <td className="break-words p-4">
                  {member.user?.name || 'Usuário não disponível'}
                  <span className="mt-1 block text-xs text-text-secondary [overflow-wrap:anywhere]">
                    {member.user?.email}
                  </span>
                </td>
                <td className="p-4">{clinicRoleLabels[member.role]}</td>
                <td className="space-y-2 p-4">
                  <UserStatusBadge active={member.active} />
                  <p className="text-xs text-text-secondary">
                    Conta {member.user?.active ? 'ativa' : 'inativa'}
                  </p>
                </td>
                <td className="space-y-2 p-4">
                  {manage || system ? actions(member) : 'Somente consulta'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
