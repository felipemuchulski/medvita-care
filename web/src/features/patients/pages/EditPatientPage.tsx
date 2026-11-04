import { Navigate, useNavigate, useParams } from 'react-router'
import { useClinic } from '../../../hooks/use-clinic'
import PatientForm from '../components/PatientForm'
import PatientsUnavailable from '../components/PatientsUnavailable'
import { usePatient, useUpdatePatient } from '../hooks/use-patients'
import { canWritePatients } from '../lib/patient-permissions'
import type { PatientPayload } from '../types/patient'

export default function EditPatientPage() {
  const { patientId } = useParams()
  const { activeClinicId, activeRole } = useClinic()
  const navigate = useNavigate()
  const patientQuery = usePatient(activeClinicId, patientId)

  if (!activeClinicId) return <PatientsUnavailable />
  if (!canWritePatients(activeRole)) return <Navigate to="/pacientes" replace />
  if (!patientId) return <Navigate to="/pacientes" replace />
  if (patientQuery.isLoading) return <p role="status" className="rounded-xl border border-border bg-white p-10 text-center">Carregando paciente...</p>
  if (!patientQuery.data) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-10 text-center text-red-800">Não foi possível carregar o paciente.</p>

  return <EditPatientContent clinicId={activeClinicId} patientId={patientId} patient={patientQuery.data} onUpdated={() => navigate(`/pacientes/${patientId}`, { replace: true, state: { notice: 'Cadastro atualizado com sucesso.' } })} />
}

function EditPatientContent({ clinicId, patientId, patient, onUpdated }: { clinicId: string; patientId: string; patient: NonNullable<ReturnType<typeof usePatient>['data']>; onUpdated: () => void }) {
  const mutation = useUpdatePatient(clinicId, patientId)
  async function update(payload: PatientPayload): Promise<void> { await mutation.mutateAsync(payload); onUpdated() }
  return <div className="mx-auto max-w-4xl space-y-6"><div><h1 className="text-2xl font-bold">Editar paciente</h1><p className="mt-1 text-sm text-text-secondary">Atualize somente os dados que foram confirmados.</p></div><PatientForm patient={patient} submitLabel="Salvar alterações" cancelTo={`/pacientes/${patientId}`} onSubmit={update} /></div>
}
