// @vitest-environment happy-dom
import { act, StrictMode, useLayoutEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { ClinicProvider } from './ClinicProvider'
import { AuthorizationBoundary } from './AuthorizationBoundary'
import { useAuth } from '../hooks/use-auth'
import { useClinic } from '../hooks/use-clinic'
import { queryClient } from '../lib/query-client'
import { getAuthorization, setAuthorizationUser } from '../lib/authorization-store'
import { httpClient } from '../api/http-client'
import { usePatients, useCreatePatient } from '../features/patients/hooks/use-patients'
import ProtectedRoute from '../features/auth/routes/ProtectedRoute'
import CreatePatientPage from '../features/patients/pages/CreatePatientPage'
import type { AuthResponse, ClinicRole } from '../features/auth/types/auth'
import type { ClinicMembership } from '../features/clinics/types/clinic'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
function session(
  id = 'user-a',
  role: ClinicRole = 'ADMIN',
  clinics = ['clinic-a'],
): AuthResponse {
  return {
    accessToken: `synthetic-${id}-${role}`,
    expiresIn: 900,
    tokenType: 'Bearer',
    user: {
      id,
      name: 'Usuário sintético',
      email: `${id}@example.invalid`,
      isSystemAdmin: false,
      clinicRoles: clinics.map((clinicId) => ({ clinicId, role })),
    },
  }
}
function memberships(auth: AuthResponse): ClinicMembership[] {
  return auth.user.clinicRoles.map((m) => ({
    ...m,
    id: `membership-${m.clinicId}`,
    userId: auth.user.id,
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    clinic: { id: m.clinicId, name: m.clinicId, document: 'synthetic', active: true },
  }))
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
let serverSession: AuthResponse | null
let serverMembers: ClinicMembership[]
let patientResponse: (() => Response | Promise<Response>) | undefined
let root: Root | undefined
let container: HTMLDivElement
let auth: ReturnType<typeof useAuth>
let clinic: ReturnType<typeof useClinic>
let save: ReturnType<typeof useCreatePatient>['mutateAsync']
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>
let clinicHistory: (string | null)[]
const payload = { name: 'Paciente sintético', birthDate: '2000-01-01' }
function Driver() {
  const a = useAuth(),
    c = useClinic()
  useLayoutEffect(() => {
    auth = a
    clinic = c
    clinicHistory.push(c.activeClinicId)
  })
  return null
}
function Panel() {
  const a = useAuth(),
    c = useClinic()
  const rows = usePatients(c.activeClinicId, { page: 1 })
  const mutation = useCreatePatient(c.activeClinicId ?? '')
  const [draft, setDraft] = useState('')
  useLayoutEffect(() => {
    save = mutation.mutateAsync
  })
  return (
    <>
      <p>
        {a.user?.id}:{c.activeClinicId}:{c.activeRole}
      </p>
      {rows.isSuccess ? (
        <form onSubmit={(e) => e.preventDefault()}>
          <p>{rows.data.data.map((p) => p.name).join(',')}</p>
          <label>
            Rascunho
            <input
              aria-label="Rascunho"
              value={draft}
              onInput={(e) => setDraft(e.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            disabled={c.activeRole === 'OPHTHALMOLOGIST'}
            onClick={() => void mutation.mutateAsync(payload).catch(() => undefined)}
          >
            Salvar
          </button>
        </form>
      ) : (
        <p role="status">Carregando dados</p>
      )}
    </>
  )
}
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 15))
  })
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 50 && !predicate(); i++) await settle()
  expect(predicate()).toBe(true)
}
function visibleText() {
  return [...container.querySelectorAll('p,section,button')]
    .filter((el) => !el.closest('[hidden]'))
    .map((el) => el.textContent)
    .join(' ')
}
function patientData(name = 'DADO-SINTETICO-A') {
  return {
    data: [{ id: 'patient', clinicId: 'clinic-a', name }],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }
}
async function mount(path = '/pacientes', strict = false) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>Login necessário</p> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/pacientes', element: <Panel /> },
          { path: '/pacientes/novo', element: <CreatePatientPage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  root = createRoot(container)
  const content = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClinicProvider>
          <Driver />
          <AuthorizationBoundary>
            <RouterProvider router={router} />
          </AuthorizationBoundary>
        </ClinicProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
  await act(async () => {
    root!.render(strict ? <StrictMode>{content}</StrictMode> : content)
  })
  await until(() => auth?.status !== 'loading')
  return router
}
async function refetchMemberships() {
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['clinic-memberships'] })
  })
  await settle()
}
async function acknowledge() {
  const button = [...container.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Descartar edição'),
  )!
  expect(button.disabled).toBe(false)
  await act(async () => button.click())
  await settle()
}
beforeEach(() => {
  setAuthorizationUser(null, true)
  queryClient.clear()
  serverSession = session()
  serverMembers = memberships(serverSession)
  patientResponse = undefined
  clinicHistory = []
  container = document.createElement('div')
  document.body.append(container)
  fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const path = String(url)
    if (path.endsWith('/auth/refresh'))
      return serverSession ? json(serverSession) : json({}, 401)
    if (path.endsWith('/auth/login')) return json(serverSession)
    if (path.endsWith('/auth/logout')) return json({ message: 'ok' })
    if (/\/users\/[^/]+\/clinics$/.test(path)) return json(serverMembers)
    if (init?.method === 'POST') return json({ id: 'new-patient', ...payload })
    return patientResponse
      ? patientResponse()
      : json(
          patientData(
            `DADO-${serverSession?.user.id}-${path.includes('clinic-b') ? 'B' : 'A'}`,
          ),
        )
  })
  vi.stubGlobal('fetch', fetcher)
  Object.defineProperty(window, 'confirm', {
    configurable: true,
    value: vi.fn(() => true),
  })
})
afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  setAuthorizationUser(null, true)
  queryClient.clear()
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('A05 real providers, QueryClient, HTTP and boundary integration', () => {
  it('restores the session and one private context in StrictMode without duplicate refresh', async () => {
    await mount('/pacientes', true)
    await until(() => visibleText().includes('DADO-user-a-A'))
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')),
    ).toHaveLength(1)
    expect(auth.user?.id).toBe('user-a')
    expect(clinic.activeClinicId).toBe('clinic-a')
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .find((q) => q.queryKey[0] === 'patients' && q.state.data !== undefined)
        ?.queryKey.at(-1),
    ).toEqual({
      authorization: [
        'user-a',
        'clinic-a',
        getAuthorization().identity,
        getAuthorization().revision,
      ],
    })
  })
  it('supports login after failed restoration and clears all private data on logout', async () => {
    serverSession = null
    await mount()
    expect(visibleText()).toContain('Login necessário')
    serverSession = session()
    serverMembers = memberships(serverSession)
    await act(async () =>
      auth.login({ email: 'synthetic@example.invalid', password: 'synthetic' }),
    )
    expect(auth.status).toBe('authenticated')
    await act(async () => auth.logout())
    expect(auth.status).toBe('unauthenticated')
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .some((q) => String(JSON.stringify(q.state.data)).includes('DADO-')),
    ).toBe(false)
  })
  it('never reuses the cache when the user changes, including a late private response', async () => {
    const late = deferred<Response>()
    patientResponse = () => late.promise
    const router = await mount()
    await until(() =>
      fetcher.mock.calls.some(([url]) => String(url).includes('/patients')),
    )
    serverSession = session('user-b')
    serverMembers = memberships(serverSession)
    patientResponse = () => json(patientData('DADO-user-b'))
    await act(async () =>
      auth.login({ email: 'user-b@example.invalid', password: 'synthetic' }),
    )
    await act(async () => router.navigate('/pacientes'))
    await until(() => visibleText().includes('DADO-user-b'))
    await act(async () => late.resolve(json(patientData('SEGREDO-ANTIGO'))))
    await settle()
    expect(visibleText()).not.toContain('SEGREDO-ANTIGO')
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('SEGREDO-ANTIGO')
  })
  it('cancels/removes old clinic queries and scopes the new clinic explicitly', async () => {
    serverSession = session('user-a', 'ADMIN', ['clinic-a', 'clinic-b'])
    serverMembers = memberships(serverSession)
    await mount()
    await until(() => clinic.memberships.length === 2)
    await act(async () => clinic.selectClinic('clinic-a'))
    await until(() => visibleText().includes('DADO-user-a-A'))
    await act(async () => clinic.selectClinic('clinic-b'))
    await until(() => visibleText().includes('DADO-user-a-B'))
    expect(visibleText()).not.toContain('DADO-user-a-A')
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .filter((q) => q.queryKey[0] === 'patients')
          .map((q) => q.state.data),
      ),
    ).not.toContain('DADO-user-a-A')
  })
  it.each(['RECEPTIONIST', 'OPHTHALMOLOGIST'] as const)(
    'reconciles ADMIN → %s without losing the valid clinic or silently dropping a draft',
    async (role) => {
      await mount()
      await until(() => visibleText().includes('DADO-user-a-A'))
      const input = container.querySelector('input')!
      await act(async () => {
        input.value = 'RASCUNHO-SINTETICO'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      const staleSave = save
      clinicHistory.length = 0
      serverSession = session('user-a', role)
      serverMembers = memberships(serverSession)
      await refetchMemberships()
      expect(auth.user?.clinicRoles[0].role).toBe(role)
      expect(clinic.activeClinicId).toBe('clinic-a')
      expect(clinicHistory.every((id) => id === 'clinic-a')).toBe(true)
      expect(visibleText()).toContain('dados digitados estão ocultos')
      expect(container.querySelector('input')!.value).toBe('RASCUNHO-SINTETICO')
      expect(container.querySelector('input')!.closest('[hidden]')).not.toBeNull()
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Alteração de acesso',
      )
      await act(async () => {
        await expect(staleSave(payload)).rejects.toMatchObject({
          code: 'REQUEST_ABORTED',
        })
      })
      expect(
        fetcher.mock.calls.filter(
          ([url, init]) => String(url).includes('/patients') && init?.method === 'POST',
        ),
      ).toHaveLength(0)
      await acknowledge()
      await until(() => visibleText().includes(role))
      expect(container.querySelector('input')?.value).toBe('')
    },
  )
  it.each(['membership', 'clinic'] as const)(
    'hides private data when the active %s is disabled',
    async (kind) => {
      await mount()
      await until(() => visibleText().includes('DADO-user-a-A'))
      if (kind === 'membership') serverMembers[0].active = false
      else serverMembers[0].clinic!.active = false
      serverSession = {
        ...serverSession!,
        user: { ...serverSession!.user, clinicRoles: [] },
      }
      await refetchMemberships()
      expect(clinic.activeClinicId).toBeNull()
      expect(visibleText()).not.toContain('DADO-user-a-A')
      expect(visibleText()).toContain('descartada')
    },
  )
  it('rejects a late result and never repopulates data after a role change during a pending query', async () => {
    const late = deferred<Response>()
    patientResponse = () => late.promise
    await mount()
    await until(() =>
      fetcher.mock.calls.some(([url]) => String(url).includes('/patients')),
    )
    serverSession = session('user-a', 'OPHTHALMOLOGIST')
    serverMembers = memberships(serverSession)
    await refetchMemberships()
    await act(async () => late.resolve(json(patientData('DADO-ROLE-ANTIGO'))))
    await settle()
    expect(visibleText()).not.toContain('DADO-ROLE-ANTIGO')
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('DADO-ROLE-ANTIGO')
  })
  it('renews once for concurrent 401 GETs and retries each read only once', async () => {
    await mount()
    await until(() => clinic.activeClinicId === 'clinic-a')
    const counts = new Map<string, number>()
    serverSession = { ...serverSession!, accessToken: 'synthetic-renewed' }
    patientResponse = undefined
    const previous = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) => {
      if (String(url).includes('/read-')) {
        const n = (counts.get(String(url)) ?? 0) + 1
        counts.set(String(url), n)
        return json({ ok: true }, n === 1 ? 401 : 200)
      }
      return previous(url, init)
    })
    const before = fetcher.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    ).length
    await act(async () => {
      await Promise.all([httpClient.get('/read-a'), httpClient.get('/read-b')])
    })
    expect([...counts.values()]).toEqual([2, 2])
    expect(
      new Headers(
        fetcher.mock.calls.filter(([url]) => String(url).endsWith('/read-a')).at(-1)?.[1]
          ?.headers,
      ).get('Authorization'),
    ).toBe('Bearer synthetic-renewed')
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')).length -
        before,
    ).toBe(1)
  })
  it('ends the session after failed refresh and prevents retry loops', async () => {
    await mount()
    await until(() => clinic.activeClinicId === 'clinic-a')
    serverSession = null
    patientResponse = () => json({}, 401)
    await act(async () => {
      await httpClient.get('/denied-401').catch(() => undefined)
    })
    expect(auth.status).toBe('unauthenticated')
    expect(visibleText()).toContain('Login necessário')
  })
  it('quarantines 403 without logout or automatic replay of the denied endpoint', async () => {
    await mount()
    await until(() => visibleText().includes('DADO-user-a-A'))
    patientResponse = () => json({}, 403)
    await act(async () => {
      await httpClient.get('/denied-403').catch(() => undefined)
    })
    await settle()
    expect(auth.status).toBe('authenticated')
    expect(visibleText()).toContain('ocultos')
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).endsWith('/denied-403')),
    ).toHaveLength(1)
    expect(visibleText()).not.toContain('DADO-user-a-A')
  })
  it('keeps the session blocked but authenticated when permission revalidation after 403 is offline', async () => {
    await mount()
    await until(() => visibleText().includes('DADO-user-a-A'))
    const previous = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) => {
      if (String(url).endsWith('/auth/refresh')) throw new TypeError('Synthetic offline')
      if (String(url).endsWith('/denied-offline')) return json({}, 403)
      return previous(url, init)
    })
    await act(async () => {
      await httpClient.get('/denied-offline').catch(() => undefined)
    })
    await settle()
    expect(auth.status).toBe('authenticated')
    expect(getAuthorization().blocked).toBe(true)
    expect(visibleText()).toContain('Verificar acesso novamente')
    expect(visibleText()).not.toContain('DADO-user-a-A')
  })
  it('does not resend a non-idempotent mutation after a successful 401 refresh', async () => {
    await mount()
    await until(() => clinic.activeClinicId === 'clinic-a')
    const previous = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) =>
      String(url).endsWith('/write-once') ? json({}, 401) : previous(url, init),
    )
    await act(async () => {
      await expect(httpClient.post('/write-once', payload)).rejects.toMatchObject({
        status: 401,
      })
    })
    expect(auth.status).toBe('authenticated')
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).endsWith('/write-once')),
    ).toHaveLength(1)
    expect(visibleText()).toContain('não foi reenviada')
  })
  it('blocks direct patient creation URL for an ophthalmologist using the real protected page', async () => {
    serverSession = session('user-a', 'OPHTHALMOLOGIST')
    serverMembers = memberships(serverSession)
    const router = await mount('/pacientes/novo')
    await until(() => router.state.location.pathname === '/pacientes')
    expect(visibleText()).not.toContain('Cadastrar paciente')
  })
  it('does not consume an old mutation result or run its cache writes after permissions change', async () => {
    await mount()
    await until(() => visibleText().includes('DADO-user-a-A'))
    const late = deferred<Response>(),
      previous = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) =>
      String(url).includes('/patients') && init?.method === 'POST'
        ? late.promise
        : previous(url, init),
    )
    let pending!: Promise<unknown>
    await act(async () => {
      pending = save(payload).catch((error) => error)
    })
    serverSession = session('user-a', 'OPHTHALMOLOGIST')
    serverMembers = memberships(serverSession)
    await refetchMemberships()
    await act(async () => late.resolve(json({ id: 'old-saved', name: 'SAVED-OLD' })))
    expect(await pending).toMatchObject({ code: 'REQUEST_ABORTED' })
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('SAVED-OLD')
  })
  it('does not let a delayed logout clear a newer login', async () => {
    const router = await mount()
    await until(() => visibleText().includes('DADO-user-a-A'))
    const late = deferred<Response>(),
      previous = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, init) =>
      String(url).endsWith('/auth/logout') ? late.promise : previous(url, init),
    )
    let pending!: Promise<void>
    await act(async () => {
      pending = auth.logout()
    })
    serverSession = session('user-b')
    serverMembers = memberships(serverSession)
    await act(async () =>
      auth.login({ email: 'user-b@example.invalid', password: 'synthetic' }),
    )
    await act(async () => router.navigate('/pacientes'))
    await act(async () => late.resolve(json({ message: 'old logout' })))
    await pending
    await settle()
    expect(auth.status).toBe('authenticated')
    expect(auth.user?.id).toBe('user-b')
  })
  it('allows cancelling a voluntary clinic switch without discarding form data', async () => {
    serverSession = session('user-a', 'ADMIN', ['clinic-a', 'clinic-b'])
    serverMembers = memberships(serverSession)
    await mount()
    await until(() => clinic.memberships.length === 2)
    await act(async () => clinic.selectClinic('clinic-a'))
    await until(() => visibleText().includes('DADO-user-a-A'))
    const input = container.querySelector('input')!
    await act(async () => {
      input.value = 'MANTER-RASCUNHO'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    vi.mocked(window.confirm).mockReturnValue(false)
    const revision = getAuthorization().revision
    await act(async () => clinic.selectClinic('clinic-b'))
    expect(clinic.activeClinicId).toBe('clinic-a')
    expect(getAuthorization().revision).toBe(revision)
    expect(container.querySelector('input')!.value).toBe('MANTER-RASCUNHO')
  })
})
