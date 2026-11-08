import { Navigate, useNavigate } from 'react-router'
import { useClinic } from '../../../hooks/use-clinic'
import PatientForm from '../components/PatientForm'
import PatientsUnavailable from '../components/PatientsUnavailable'
import { useCreatePatient } from '../hooks/use-patients'
import { canWritePatients } from '../lib/patient-permissions'
import type { PatientPayload } from '../types/patient'

export default function CreatePatientPage() {
  const { activeClinicId, activeRole } = useClinic()
  const navigate = useNavigate()

  if (!activeClinicId) return <PatientsUnavailable />
  if (!canWritePatients(activeRole))
    return (
      <Navigate
        to="/pacientes"
        replace
      />
    )

  return (
    <CreatePatientContent
      clinicId={activeClinicId}
      onCreated={(id) =>
        navigate(`/pacientes/${id}`, {
          replace: true,
          state: { notice: 'Paciente cadastrado com sucesso.' },
        })
      }
    />
  )
}

function CreatePatientContent({
  clinicId,
  onCreated,
}: {
  clinicId: string
  onCreated: (id: string) => void
}) {
  const mutation = useCreatePatient(clinicId)
  async function create(payload: PatientPayload): Promise<void> {
    const patient = await mutation.mutateAsync(payload)
    onCreated(patient.id)
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novo paciente</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Preencha os dados cadastrais disponíveis.
        </p>
      </div>
      <PatientForm
        submitLabel="Cadastrar paciente"
        cancelTo="/pacientes"
        onSubmit={create}
      />
    </div>
  )
}
