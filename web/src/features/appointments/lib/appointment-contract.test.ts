import { describe, expect, it } from 'vitest'
import { appointmentToEvent } from '../../calendar/utils/appointmentToEvent'
import { canStartEncounter } from '../../medical-records/lib/encounter'
import type { EncounterStatus } from '../../medical-records/types/encounter'
import type { Appointment } from '../types/appointment'
import { canChange } from './appointment'

const appointment: Appointment = {
  id: 'synthetic-appointment',
  clinicId: 'synthetic-clinic',
  patientId: 'synthetic-patient',
  professionalId: 'synthetic-professional',
  scheduledAt: '2027-01-10T10:00:00-03:00',
  endsAt: '2027-01-10T10:30:00-03:00',
  durationMinutes: 30,
  status: 'SCHEDULED',
  reason: null,
  notes: null,
  cancellationReason: null,
  patient: { id: 'synthetic-patient', name: 'Paciente sintético' },
  professional: {
    id: 'synthetic-professional',
    userId: 'synthetic-doctor',
    crm: '123456',
    crmState: 'SP',
    user: { id: 'synthetic-doctor', name: 'Médico sintético' },
  },
  encounter: null,
}

describe('operational appointment response contract', () => {
  it('allows starting an unlinked appointment only for its assigned physician', () => {
    expect(canStartEncounter(appointment, 'synthetic-doctor')).toBe(true)
    expect(canStartEncounter(appointment, 'other-doctor')).toBe(false)
    expect(canChange(appointment)).toBe(true)
  })

  it.each<EncounterStatus>(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])(
    'recognizes encounter existence and %s status without clinical content',
    status => {
      const linked: Appointment = {
        ...appointment,
        encounter: { id: 'synthetic-encounter', status },
      }
      expect(linked.encounter?.id).toBe('synthetic-encounter')
      expect(linked.encounter?.status).toBe(status)
      expect(canStartEncounter(linked, 'synthetic-doctor')).toBe(false)
      expect(canChange(linked)).toBe(false)
    },
  )

  it('preserves calendar mapping using only the minimal related fields', () => {
    const event = appointmentToEvent(appointment)
    expect(event).toMatchObject({
      id: appointment.id,
      title: 'Paciente sintético',
      start: appointment.scheduledAt,
      end: appointment.endsAt,
      editable: false,
      extendedProps: { professional: 'Médico sintético', status: 'SCHEDULED' },
    })
  })
})
