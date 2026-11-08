import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../../hooks/use-auth'
import { useClinic } from '../../../hooks/use-clinic'
import { buttonClass } from '../../appointments/components/Selectors'
import type { Appointment } from '../../appointments/types/appointment'
import { useEncounterMutations } from '../hooks/use-encounters'
import {
  canReadClinicalRecords,
  canStartEncounter,
  clinicalError,
} from '../lib/encounter'
export function EncounterAppointmentAction({
  appointment,
}: {
  appointment: Appointment
}) {
  const { user } = useAuth()
  const { activeRole, activeClinicId } = useClinic()
  if (
    !user ||
    !canReadClinicalRecords(activeRole) ||
    activeClinicId !== appointment.clinicId ||
    appointment.professional.userId !== user.id
  )
    return null
  return (
    <Action
      key={`${activeClinicId}:${user.id}:${appointment.id}`}
      appointment={appointment}
      user={user.id}
    />
  )
}
function Action({ appointment, user }: { appointment: Appointment; user: string }) {
  const mutations = useEncounterMutations(appointment.clinicId, user)
  const navigate = useNavigate()
  const lock = useRef(false)
  const [error, setError] = useState('')
  if (appointment.encounter)
    return (
      <Link
        className={buttonClass}
        to={`/prontuarios/atendimentos/${appointment.encounter.id}`}
      >
        Abrir atendimento
      </Link>
    )
  if (!canStartEncounter(appointment, user)) return null
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={buttonClass}
        disabled={mutations.start.isPending}
        onClick={async () => {
          if (lock.current) return
          lock.current = true
          setError('')
          try {
            const record = await mutations.start.mutateAsync(appointment.id)
            navigate(`/prontuarios/atendimentos/${record.id}`)
          } catch (e) {
            setError(clinicalError(e))
          } finally {
            lock.current = false
            mutations.start.reset()
          }
        }}
      >
        {mutations.start.isPending ? 'Iniciando...' : 'Iniciar atendimento'}
      </button>
      {error && (
        <p
          role="alert"
          className="text-red-800"
        >
          {error}
        </p>
      )}
    </div>
  )
}
