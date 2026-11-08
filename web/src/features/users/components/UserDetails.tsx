import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { buttonClass } from '../../appointments/components/Selectors'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import { clinicRoleLabels } from '../../clinics/lib/clinic'
import { useUserCommitted, useUserMemberships } from '../hooks/use-users'
import { usersApi } from '../api/users-api'
import { userError } from '../lib/user'
import type { ManagedUser } from '../types/user'
import { UserStatusBadge } from './UserStatusBadge'
export function UserDetails({
  actor,
  record,
  notice,
}: {
  actor: string
  record: ManagedUser
  notice?: string
}) {
  const { user } = useAuth()
  const links = useUserMemberships(actor, record.id)
  const committed = useUserCommitted()
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(notice || '')
  const lock = useRef(false)
  async function active() {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError('')
    try {
      const saved = await usersApi.active(record.id, !record.active)
      await committed(saved)
      setConfirm(false)
      setMessage(
        saved.active ? 'Usuário ativado com sucesso.' : 'Usuário desativado com sucesso.',
      )
    } catch (e) {
      setError(userError(e))
    } finally {
      lock.current = false
      setPending(false)
    }
  }
  return (
    <>
      <Link
        to="/usuarios"
        className={buttonClass}
      >
        Voltar aos usuários
      </Link>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-primary-light p-3 text-primary"
        >
          {message}
        </p>
      )}
      <section className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6">
        <header className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-semibold">{record.name}</h2>
          <UserStatusBadge active={record.active} />
        </header>
        <p className="[overflow-wrap:anywhere]">{record.email}</p>
        <p className="text-sm text-text-secondary">
          {record.isSystemAdmin
            ? 'Administrador do sistema'
            : 'Sem acesso de administrador global'}
        </p>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          to={`/usuarios/${record.id}/editar`}
          className={buttonClass}
        >
          Editar usuário
        </Link>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setError('')
            setConfirm(true)
          }}
        >
          {record.active ? 'Desativar conta' : 'Ativar conta'}
        </button>
        {record.id === user?.id && (
          <Link
            to="/alterar-senha"
            className={buttonClass}
          >
            Alterar minha senha
          </Link>
        )}
      </div>
      <section className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Vínculos com clínicas</h2>
        <p className="text-sm text-text-secondary">
          A conta é única. Cada clínica define o papel e o status do vínculo. Perfil
          profissional é cadastrado separadamente em Profissionais.
        </p>
        {links.isPending ? (
          <p role="status">Carregando vínculos...</p>
        ) : links.isError ? (
          <div
            role="alert"
            className="space-y-3"
          >
            <p>{userError(links.error)}</p>
            <button
              type="button"
              className={buttonClass}
              onClick={() => void links.refetch()}
            >
              Tentar novamente
            </button>
          </div>
        ) : !links.data.length ? (
          <p>Nenhum vínculo cadastrado para este usuário.</p>
        ) : (
          <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
            {links.data.map((link) => (
              <li
                key={link.id}
                className="min-w-0 space-y-2 rounded-lg border border-border p-3 text-sm"
              >
                <h3 className="font-semibold">
                  {link.clinic?.name || 'Clínica não disponível'}
                </h3>
                <p>
                  {clinicRoleLabels[link.role]} · Vínculo{' '}
                  {link.active ? 'ativo' : 'inativo'} · Clínica{' '}
                  {link.clinic?.active ? 'ativa' : 'inativa'}
                </p>
                <Link
                  to={`/clinicas/${link.clinicId}/usuarios?userId=${record.id}`}
                  className={buttonClass}
                >
                  Gerenciar vínculo
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/clinicas"
          className={buttonClass}
        >
          Selecionar clínica para novo vínculo
        </Link>
      </section>
      {confirm && (
        <ClinicalDialog
          title={record.active ? 'Desativar conta?' : 'Ativar conta?'}
          label="Confirmar alteração"
          pending={pending}
          onClose={() => setConfirm(false)}
          onConfirm={() => void active()}
        >
          <p>
            <strong>{record.name}</strong>
          </p>
          <p>
            A alteração revoga as sessões dessa conta. Os vínculos e registros históricos
            são preservados.
            {record.id === actor ? ' Sua sessão também será encerrada.' : ''}
          </p>
          {error && (
            <p
              role="alert"
              className="text-red-800"
            >
              {error}
            </p>
          )}
        </ClinicalDialog>
      )}
    </>
  )
}
