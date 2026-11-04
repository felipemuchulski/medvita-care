import { ArrowLeft, Pencil } from 'lucide-react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { isApiError } from '../../../api/api-error'
import { useClinic } from '../../../hooks/use-clinic'
import PatientStatusBadge from '../components/PatientStatusBadge'
import PatientsUnavailable from '../components/PatientsUnavailable'
import { usePatient, useUpdatePatientStatus } from '../hooks/use-patients'
import { formatCpf, formatDateOnly, formatZipCode } from '../lib/patient-format'
import { canChangePatientStatus, canReadPatients, canWritePatients } from '../lib/patient-permissions'

const sexLabels = { MALE: 'Masculino', FEMALE: 'Feminino', NOT_INFORMED: 'Não informado' }

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</dt><dd className="mt-1 break-words text-sm text-text-primary">{value || 'Não informado'}</dd></div>
}

export default function PatientDetailsPage() {
  const { patientId } = useParams()
  const location = useLocation()
  const { activeClinicId, activeRole } = useClinic()
  const patientQuery = usePatient(activeClinicId, patientId)
  const statusMutation = useUpdatePatientStatus(activeClinicId ?? '', patientId ?? '')

  if (!activeClinicId || !canReadPatients(activeRole)) return <PatientsUnavailable />
  if (!patientId) return <Navigate to="/pacientes" replace />

  if (patientQuery.isLoading) return <div role="status" className="rounded-xl border border-border bg-white px-5 py-12 text-center">Carregando paciente...</div>
  if (patientQuery.error || !patientQuery.data) {
    const message = isApiError(patientQuery.error) ? patientQuery.error.message : 'Paciente não encontrado.'
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-10 text-center text-red-800">{message}</div>
  }

  const patient = patientQuery.data
  const address = [patient.street, patient.number, patient.complement].filter(Boolean).join(', ')
  const locationLine = [patient.neighborhood, patient.city, patient.state].filter(Boolean).join(' · ')

  function toggleStatus(): void {
    const action = patient.active ? 'desativar' : 'ativar'
    if (!window.confirm(`Deseja realmente ${action} o paciente ${patient.name}?`)) return
    statusMutation.mutate(!patient.active)
  }

  return (
    <div className="space-y-6">
      <Link to="/pacientes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={18} /> Voltar para pacientes</Link>
      {(location.state as { notice?: string } | null)?.notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{(location.state as { notice: string }).notice}</p>}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-2xl font-bold">{patient.name}</h1><PatientStatusBadge active={patient.active} /></div><p className="mt-2 text-sm text-text-secondary">CPF: {formatCpf(patient.cpf)}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canWritePatients(activeRole) && <Link to={`/pacientes/${patient.id}/editar`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary"><Pencil size={17} /> Editar</Link>}
          {canChangePatientStatus(activeRole) && <button type="button" onClick={toggleStatus} disabled={statusMutation.isPending} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${patient.active ? 'border border-red-300 text-red-700 hover:bg-red-50' : 'bg-emerald-700 text-white hover:bg-emerald-800'} disabled:opacity-60`}>{statusMutation.isPending ? 'Salvando...' : patient.active ? 'Desativar' : 'Ativar'}</button>}
        </div>
      </div>

      {statusMutation.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{isApiError(statusMutation.error) ? statusMutation.error.message : 'Não foi possível alterar o status.'}</p>}

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">Dados cadastrais</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Nascimento" value={formatDateOnly(patient.birthDate)} /><Detail label="Sexo" value={patient.sex ? sexLabels[patient.sex] : null} /><Detail label="Telefone" value={patient.phone} /><Detail label="E-mail" value={patient.email} /><Detail label="CEP" value={formatZipCode(patient.zipCode)} /><Detail label="Endereço" value={address} /><Detail label="Localidade" value={locationLine} /></dl></section>

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">Histórico clínico</h2><p className="mt-2 text-sm text-text-secondary">O histórico será apresentado aqui quando o módulo de atendimentos for integrado. Nenhum dado clínico simulado é exibido.</p></section>
    </div>
  )
}
