// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../../contexts/auth-context'
import { ClinicContext } from '../../../contexts/clinic-context'
import { httpClient } from '../../../api/http-client'
import { queryClient } from '../../../lib/query-client'
import {
  setAuthorizationClinic,
  setAuthorizationUser,
} from '../../../lib/authorization-store'
import { useCalendarAppointments } from '../../calendar/hooks/use-calendar-appointments'
import type { ClinicRole } from '../../auth/types/auth'
import type { Appointment } from '../types/appointment'
import AppointmentsPage from './AppointmentsPage'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let container: HTMLDivElement
let root: Root | undefined
let appointment: Appointment
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>
let errorStatus: number | undefined
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const noop = async () => undefined
function CalendarObserver() {
  const query = useCalendarAppointments('clinic-a', '2040-01-01', '2040-01-07', {})
  return (
    <output aria-label="Estado da agenda">
      {query.data?.map((a) => `${a.status}:${a.durationMinutes}`).join(',')}
    </output>
  )
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 60 && !predicate(); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
  expect(predicate()).toBe(true)
}
async function mount(
  path = '/agendamentos/appointment',
  role: ClinicRole = 'OPHTHALMOLOGIST',
) {
  const user = {
    id: 'doctor',
    name: 'Usuário sintético',
    email: 'synthetic@example.invalid',
    isSystemAdmin: false,
    clinicRoles: [{ clinicId: 'clinic-a', role }],
  }
  setAuthorizationUser(user, true)
  setAuthorizationClinic('clinic-a')
  const router = createMemoryRouter(
    [
      { path: '/agendamentos/:appointmentId', element: <AppointmentsPage /> },
      { path: '/agendamentos/:appointmentId/reagendar', element: <AppointmentsPage /> },
    ],
    { initialEntries: [path] },
  )
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            status: 'authenticated',
            user,
            login: noop,
            logout: noop,
            changePassword: noop,
            revalidateSession: async () => true,
          }}
        >
          <ClinicContext.Provider
            value={{
              memberships: [],
              activeMembership: null,
              activeClinicId: 'clinic-a',
              activeRole: role,
              isLoading: false,
              error: null,
              selectClinic: () => undefined,
            }}
          >
            <CalendarObserver />
            <RouterProvider router={router} />
          </ClinicContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
  })
  await until(() => !!container.querySelector('h1, [role="alert"]'))
  return router
}
beforeEach(() => {
  queryClient.clear()
  errorStatus = undefined
  appointment = {
    id: 'appointment',
    clinicId: 'clinic-a',
    professionalId: 'professional',
    patientId: 'patient',
    scheduledAt: '2040-01-02T12:00:00Z',
    endsAt: '2040-01-02T12:30:00Z',
    durationMinutes: 30,
    status: 'SCHEDULED',
    reason: 'Consulta sintética',
    notes: null,
    cancellationReason: null,
    encounter: null,
    patient: { id: 'patient', name: 'Paciente sintético' },
    professional: {
      id: 'professional',
      userId: 'doctor',
      crm: '12345',
      crmState: 'SP',
      user: { id: 'doctor', name: 'Médico sintético' },
    },
  }
  container = document.createElement('div')
  document.body.append(container)
  httpClient.configureAuth({ getAccessToken: () => 'synthetic-access' })
  fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const path = new URL(String(url), 'http://localhost').pathname
    if (init?.method === 'PATCH') {
      if (errorStatus) return json({ message: 'Falha sintética' }, errorStatus)
      const body = JSON.parse(String(init.body))
      appointment = path.endsWith('/cancel')
        ? { ...appointment, status: 'CANCELLED', cancellationReason: body.reason }
        : { ...appointment, ...body }
      return json(appointment)
    }
    if (path.endsWith('/appointments'))
      return json({
        data: [appointment],
        meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
      })
    if (path.endsWith('/appointment')) return json(appointment)
    throw new Error(`Unexpected synthetic URL: ${path}`)
  })
  vi.stubGlobal('fetch', fetcher)
})
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  container.remove()
  httpClient.configureAuth(undefined)
  setAuthorizationUser(null, true)
  queryClient.clear()
  vi.unstubAllGlobals()
})
it.each(['OPHTHALMOLOGIST', 'ADMIN', 'RECEPTIONIST'] as const)(
  '%s sees reschedule and cancel on an authorized appointment',
  async (role) => {
    await mount(undefined, role)
    expect(container.querySelector('a[href$="/reagendar"]')?.textContent).toBe(
      'Reagendar',
    )
    expect(container.textContent).toContain('Cancelar agendamento')
  },
)
it.each([
  'other-doctor',
  'other-clinic',
  'CANCELLED',
  'COMPLETED',
  'encounter-running',
  'encounter-completed',
])('hides actions and denies direct reschedule for %s', async (scenario) => {
  if (scenario === 'other-doctor') appointment.professional.userId = 'other'
  else if (scenario === 'other-clinic') appointment.clinicId = 'clinic-b'
  else if (scenario.startsWith('encounter'))
    appointment.encounter = {
      id: 'encounter',
      status: scenario === 'encounter-running' ? 'IN_PROGRESS' : 'COMPLETED',
    }
  else appointment.status = scenario as Appointment['status']
  const router = await mount()
  expect(container.querySelector('a[href$="/reagendar"]')).toBeNull()
  expect(container.textContent).not.toContain('Cancelar agendamento')
  await act(async () => {
    await router.navigate('/agendamentos/appointment/reagendar')
  })
  expect(container.querySelector('form')).toBeNull()
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
})
it('reschedules the own appointment with the existing form and refreshes detail/calendar through A05 queries', async () => {
  const router = await mount('/agendamentos/appointment/reagendar')
  const form = container.querySelector('form')!
  expect(form).not.toBeNull()
  expect(form.querySelector('select')).toBeNull() // No assignment or patient editing.
  const duration = form.querySelector<HTMLInputElement>('[name="duration"]')!
  duration.value = '45'
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await until(
    () =>
      router.state.location.pathname === '/agendamentos/appointment' &&
      container.textContent!.includes('Agendamento reagendado com sucesso.'),
  )
  await until(() => container.querySelector('output')?.textContent === 'SCHEDULED:45')
  const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')
  expect(writes).toHaveLength(1)
  expect(JSON.parse(String(writes[0][1]!.body))).toEqual({
    scheduledAt: '2040-01-02T09:00:00-03:00',
    durationMinutes: 45,
  })
  expect(container.textContent).toContain('45 minutos')
})
it('requires confirmation/reason, focuses the existing dialog and updates the calendar after cancellation', async () => {
  await mount()
  const opener = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === 'Cancelar agendamento',
  )!
  await act(async () => {
    opener.focus()
    opener.click()
  })
  const dialog = container.querySelector('dialog')!
  expect(dialog.open).toBe(true)
  const reason = dialog.querySelector('textarea')!
  expect(document.activeElement).toBe(reason)
  const confirm = [...dialog.querySelectorAll('button')].find(
    (b) => b.textContent === 'Confirmar cancelamento',
  )!
  expect(confirm.disabled).toBe(true)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      reason,
      'Motivo sintético',
    )
    reason.dispatchEvent(new Event('input', { bubbles: true }))
    reason.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(confirm.disabled).toBe(false)
  await act(async () => {
    dialog
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await until(() => container.textContent!.includes('Agendamento cancelado com sucesso.'))
  await until(() => container.querySelector('output')?.textContent === 'CANCELLED:30')
  expect(container.querySelector('dialog')).toBeNull()
  expect(container.querySelector('a[href$="/reagendar"]')).toBeNull()
  const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')
  expect(writes).toHaveLength(1)
  expect(JSON.parse(String(writes[0][1]!.body))).toEqual({ reason: 'Motivo sintético' })
})
it('keeps conflict feedback accessible and never automatically replays the reschedule', async () => {
  errorStatus = 409
  await mount('/agendamentos/appointment/reagendar')
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await until(() => !!container.querySelector('form [role="alert"]'))
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    'já possui um agendamento',
  )
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(
    1,
  )
})
