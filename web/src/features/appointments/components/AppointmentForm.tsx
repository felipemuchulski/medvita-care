import { useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useUnsavedClinicalChanges } from '../../medical-records/hooks/use-unsaved-clinical-changes'
import { ClinicalDialog } from '../../medical-records/components/ClinicalDialog'
import { FormErrorSummary } from '../../../components/forms/FormFeedback'
import { useFormErrorFocus } from '../../../lib/form-feedback'
import type { Appointment, AppointmentPayload } from '../types/appointment'
import { defaultOffset, localInOffset, toIso } from '../lib/appointment'
import {
  buttonClass,
  inputClass,
  PatientSelector,
  ProfessionalSelector,
} from './Selectors'
export function AppointmentForm({
  clinic,
  appointment,
  initialDate = '',
  initialTime = '',
  pending,
  onSave,
  onSaved,
}: {
  clinic: string
  appointment?: Appointment
  initialDate?: string
  initialTime?: string
  pending: boolean
  onSave: (payload: AppointmentPayload) => Promise<void>
  onSaved?: () => void
}) {
  const { formRef, focusErrors } = useFormErrorFocus()
  const [invalidField, setInvalidField] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [dirty, setDirty] = useState(false)
  const completed = useRef(false)
  const blocker = useUnsavedClinicalChanges(
    Boolean(appointment) && dirty,
    Boolean(appointment) && pending,
    'Há alterações não salvas no reagendamento. Deseja descartá-las e continuar?',
    () => completed.current,
  )
  const [patientId, setPatient] = useState(appointment?.patientId ?? '')
  const [professionalId, setProfessional] = useState(appointment?.professionalId ?? '')
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (lock.current || pending) return
    const data = new FormData(e.currentTarget)
    setInvalidField(null)
    const invalid = (field: string, message: string): never => {
      setInvalidField(field)
      throw new Error(message)
    }
    try {
      if (!patientId) invalid('patient', 'Selecione um paciente.')
      if (!professionalId) invalid('professional', 'Selecione um profissional.')
      if (!data.get('date')) invalid('date', 'Informe a data do agendamento.')
      if (!data.get('time')) invalid('time', 'Informe o horário do agendamento.')
      const scheduledAt = toIso(
        `${String(data.get('date'))}T${String(data.get('time'))}`,
        defaultOffset,
      )
      if (Date.parse(scheduledAt) <= Date.now())
        invalid('date', 'Escolha uma data e horário no futuro.')
      const durationMinutes = Number(data.get('duration'))
      if (
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 5 ||
        durationMinutes > 480
      )
        invalid('duration', 'Duração deve ser um inteiro entre 5 e 480 minutos.')
      setError('')
      lock.current = true
      await onSave({
        patientId,
        professionalId,
        scheduledAt,
        durationMinutes,
        reason: String(data.get('reason') ?? '').trim() || undefined,
        notes: String(data.get('notes') ?? '').trim() || undefined,
      })
      completed.current = true
      setDirty(false)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifique os campos.')
      focusErrors()
    } finally {
      lock.current = false
    }
  }
  return (
    <>
      <form
        ref={formRef}
        noValidate
        onChange={() => setDirty(true)}
        onSubmit={(e) => void submit(e)}
        className="space-y-5 rounded-xl border border-border bg-white p-4 sm:p-6"
      >
        <FormErrorSummary
          id="appointment-form-errors"
          errors={error ? { root: { message: error } } : {}}
        />
        <fieldset
          disabled={pending}
          className="min-w-0 space-y-5"
        >
          {appointment ? (
            <p className="break-words">
              {appointment.patient.name} · {appointment.professional.user.name}
            </p>
          ) : (
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <PatientSelector
                invalid={invalidField === 'patient'}
                describedBy={
                  invalidField === 'patient' ? 'appointment-form-errors' : undefined
                }
                clinic={clinic}
                value={patientId}
                onChange={setPatient}
                activeOnly
              />
              <ProfessionalSelector
                invalid={invalidField === 'professional'}
                describedBy={
                  invalidField === 'professional' ? 'appointment-form-errors' : undefined
                }
                clinic={clinic}
                value={professionalId}
                onChange={setProfessional}
              />
            </div>
          )}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
            <label className="form-field">
              Data
              <input
                name="date"
                aria-invalid={invalidField === 'date'}
                aria-describedby={
                  invalidField === 'date' ? 'appointment-form-errors' : undefined
                }
                type="date"
                required
                className={inputClass}
                defaultValue={
                  appointment
                    ? localInOffset(appointment.scheduledAt).slice(0, 10)
                    : initialDate
                }
              />
            </label>
            <label className="form-field">
              Horário
              <input
                name="time"
                aria-invalid={invalidField === 'time'}
                aria-describedby={
                  invalidField === 'time' ? 'appointment-form-errors' : undefined
                }
                type="time"
                required
                step="60"
                className={inputClass}
                defaultValue={
                  appointment
                    ? localInOffset(appointment.scheduledAt).slice(11, 16)
                    : initialTime
                }
              />
            </label>
            <label className="form-field">
              Duração em minutos
              <input
                className={inputClass}
                name="duration"
                aria-invalid={invalidField === 'duration'}
                aria-describedby={
                  invalidField === 'duration' ? 'appointment-form-errors' : undefined
                }
                type="number"
                min="5"
                max="480"
                step="1"
                required
                defaultValue={appointment?.durationMinutes ?? 30}
              />
            </label>
          </div>
          {!appointment && (
            <>
              <label className="form-field">
                Motivo da consulta
                <input
                  name="reason"
                  maxLength={500}
                  className={inputClass}
                />
              </label>
              <label className="form-field">
                Observações
                <textarea
                  name="notes"
                  maxLength={1000}
                  rows={3}
                  className={inputClass}
                />
              </label>
            </>
          )}
          <button
            type="submit"
            className={`${buttonClass} w-full sm:w-auto`}
            disabled={pending}
          >
            {pending
              ? 'Salvando...'
              : appointment
                ? 'Salvar reagendamento'
                : 'Criar agendamento'}
          </button>
          {appointment && (
            <button
              type="button"
              className={`${buttonClass} mt-3 w-full sm:ml-3 sm:mt-0 sm:w-auto`}
              disabled={pending}
              onClick={() =>
                navigate(`/agendamentos/${appointment.id}${location.search}`, {
                  state: { calendarReturn: location.state?.calendarReturn },
                })
              }
            >
              Voltar aos detalhes
            </button>
          )}
        </fieldset>
      </form>
      {blocker.state === 'blocked' && (
        <ClinicalDialog
          title={pending ? 'Aguarde o salvamento' : 'Descartar alterações?'}
          label="Descartar e voltar"
          pending={pending}
          onClose={() => blocker.reset()}
          onConfirm={() => {
            if (!pending) blocker.proceed()
          }}
        >
          <p>
            {pending
              ? 'Aguarde a confirmação do servidor antes de sair.'
              : 'Há alterações não salvas no reagendamento. Sair descartará essa edição.'}
          </p>
        </ClinicalDialog>
      )}
    </>
  )
}
