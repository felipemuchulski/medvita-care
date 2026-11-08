import { useRef, useState, type FormEvent } from 'react'
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
}: {
  clinic: string
  appointment?: Appointment
  initialDate?: string
  initialTime?: string
  pending: boolean
  onSave: (payload: AppointmentPayload) => Promise<void>
}) {
  const [patientId, setPatient] = useState(appointment?.patientId ?? '')
  const [professionalId, setProfessional] = useState(appointment?.professionalId ?? '')
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (lock.current || pending) return
    const data = new FormData(e.currentTarget)
    try {
      if (!patientId || !professionalId)
        throw new Error('Selecione paciente e profissional.')
      const scheduledAt = toIso(
        `${String(data.get('date'))}T${String(data.get('time'))}`,
        defaultOffset,
      )
      if (Date.parse(scheduledAt) <= Date.now())
        throw new Error('Escolha uma data e horário no futuro.')
      const durationMinutes = Number(data.get('duration'))
      if (
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 5 ||
        durationMinutes > 480
      )
        throw new Error('Duração deve ser um inteiro entre 5 e 480 minutos.')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifique os campos.')
    } finally {
      lock.current = false
    }
  }
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-5 rounded-xl border border-border bg-white p-4 sm:p-6"
    >
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
              clinic={clinic}
              value={patientId}
              onChange={setPatient}
              activeOnly
            />
            <ProfessionalSelector
              clinic={clinic}
              value={professionalId}
              onChange={setProfessional}
            />
          </div>
        )}
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
          <label className="min-w-0">
            Data
            <input
              name="date"
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
          <label className="min-w-0">
            Horário
            <input
              name="time"
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
          <label>
            Duração em minutos
            <input
              className={inputClass}
              name="duration"
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
            <label className="block">
              Motivo da consulta
              <input
                name="reason"
                maxLength={500}
                className={inputClass}
              />
            </label>
            <label className="block">
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
        {error && (
          <p
            role="alert"
            className="text-red-800"
          >
            {error}
          </p>
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
      </fieldset>
    </form>
  )
}
