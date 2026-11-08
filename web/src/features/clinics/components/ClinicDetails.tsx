import { useState, useRef } from 'react'
import { Link } from 'react-router'
import { buttonClass } from '../../appointments/components/Selectors'
import { useClinic } from '../../../hooks/use-clinic'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import type { Clinic } from '../types/clinic'
import { formatClinicDocument, clinicError } from '../lib/clinic'
import { useClinicMutations } from '../hooks/use-clinics'
import { ClinicStatusBadge } from './ClinicStatusBadge'
import { ClinicTeam } from './ClinicTeam'
export function ClinicDetails({
  clinic,
  user,
  system,
  edit,
  notice,
}: {
  clinic: Clinic
  user: string
  system: boolean
  edit: boolean
  notice?: string
}) {
  const context = useClinic()
  const mutation = useClinicMutations(user).active
  const [confirm, setConfirm] = useState(false)
  const [team, setTeam] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(notice || '')
  const lock = useRef(false)
  async function changeStatus() {
    if (lock.current) return
    lock.current = true
    setError('')
    const wasActive = context.activeClinicId === clinic.id
    try {
      const saved = await mutation.mutateAsync({ id: clinic.id, active: !clinic.active })
      setConfirm(false)
      setMessage(
        saved.active
          ? 'Clínica ativada com sucesso.'
          : wasActive
            ? 'Clínica desativada. Selecione outra clínica no menu para continuar as operações clínicas.'
            : 'Clínica desativada com sucesso.',
      )
    } catch (e) {
      setError(clinicError(e))
    } finally {
      lock.current = false
      mutation.reset()
    }
  }
  return (
    <>
      {system && (
        <Link
          to="/clinicas"
          className={buttonClass}
        >
          Voltar às clínicas
        </Link>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-primary-light p-3 text-primary"
        >
          {message}
        </p>
      )}
      <section
        className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
        aria-labelledby="clinic-name"
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <h2
            id="clinic-name"
            className="min-w-0 break-words text-xl font-semibold"
          >
            {clinic.name}
          </h2>
          <ClinicStatusBadge active={clinic.active} />
        </header>
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
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
          <div>
            <dt className="text-text-secondary">Telefone</dt>
            <dd>{clinic.phone || 'Não informado'}</dd>
          </div>
        </dl>
      </section>
      <section
        className="min-w-0 space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6"
        aria-labelledby="clinic-address"
      >
        <h2
          id="clinic-address"
          className="text-lg font-semibold"
        >
          Endereço
        </h2>
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          {(
            [
              ['Logradouro', clinic.street],
              ['Número', clinic.number],
              ['Complemento', clinic.complement],
              ['Bairro', clinic.neighborhood],
              ['Cidade', clinic.city],
              ['Estado', clinic.state],
              ['CEP', clinic.zipCode],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-text-secondary">{label}</dt>
              <dd>{value || 'Não informado'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {edit && (
          <Link
            to={`/clinicas/${clinic.id}/editar`}
            className={buttonClass}
          >
            Editar clínica
          </Link>
        )}
        <button
          type="button"
          className={buttonClass}
          aria-expanded={team}
          onClick={() => setTeam((value) => !value)}
        >
          {team ? 'Ocultar equipe' : 'Consultar equipe'}
        </button>
        {system && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setError('')
              setConfirm(true)
            }}
          >
            {clinic.active ? 'Desativar clínica' : 'Ativar clínica'}
          </button>
        )}
        {context.memberships.some((m) => m.clinicId === clinic.id) &&
          context.activeClinicId !== clinic.id && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => context.selectClinic(clinic.id)}
            >
              Usar esta clínica
            </button>
          )}
      </div>
      {team && (
        <ClinicTeam
          user={user}
          id={clinic.id}
        />
      )}
      {confirm && (
        <ClinicalDialog
          title={clinic.active ? 'Desativar clínica?' : 'Ativar clínica?'}
          label={clinic.active ? 'Confirmar desativação' : 'Confirmar ativação'}
          pending={mutation.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => void changeStatus()}
        >
          <p>
            <strong>{clinic.name}</strong>
          </p>
          <p>
            {clinic.active
              ? 'A clínica ficará indisponível para novas operações clínicas. Usuários, pacientes e atendimentos existentes não serão excluídos.'
              : 'A clínica voltará a estar disponível para seus usuários com vínculo ativo.'}
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
