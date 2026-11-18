import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import ProfessionalsPage from './ProfessionalsPage'
import {
  canCreateProfessionals,
  canEditProfessionals,
  professionalEditDeniedMessage,
} from '../lib/professional'

const session = vi.hoisted(() => ({
  isSystemAdmin: false,
  role: 'ADMIN' as 'ADMIN' | 'OPHTHALMOLOGIST' | 'RECEPTIONIST' | null,
  create: vi.fn(),
  update: vi.fn(),
}))
const profile = {
  id: 'synthetic-profile', userId: 'synthetic-user', crm: '123456', crmState: 'SP',
  rqe: null, specialty: 'Oftalmologia', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  user: { id: 'synthetic-user', name: 'Médico sintético', email: 'synthetic@example.invalid', active: true },
}
vi.mock('../../../hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-user', isSystemAdmin: session.isSystemAdmin } }),
}))
vi.mock('../../../hooks/use-clinic', () => ({
  useClinic: () => ({ isLoading: false, activeClinicId: 'synthetic-clinic', activeRole: session.role }),
}))
vi.mock('../hooks/use-professionals', () => ({
  useProfessional: () => ({ data: profile, isPending: false, isError: false }),
  useProfessionals: () => ({ data: [profile], isPending: false, isError: false }),
  useEligibleProfessionalUsers: () => ({ data: [], isPending: false, isError: false }),
  useProfessionalMutations: () => ({ create: { mutateAsync: session.create }, update: { mutateAsync: session.update } }),
}))

function render(path = '/profissionais') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {['/profissionais', '/profissionais/novo', '/profissionais/:professionalId', '/profissionais/:professionalId/editar'].map(path => (
          <Route key={path} path={path} element={<ProfessionalsPage />} />
        ))}
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  session.isSystemAdmin = false
  session.role = 'ADMIN'
  session.create.mockReset()
  session.update.mockReset()
})

describe('A04 professional permissions and real React rendering', () => {
  it('separates profile creation from global editing in the permission helpers', () => {
    for (const role of ['ADMIN', 'OPHTHALMOLOGIST', 'RECEPTIONIST', null] as const) {
      expect(canCreateProfessionals(role)).toBe(role === 'ADMIN')
      expect(canEditProfessionals(false)).toBe(false)
      expect(canCreateProfessionals(role, true)).toBe(true)
    }
    expect(canEditProfessionals(true)).toBe(true)
  })

  it('keeps local ADMIN creation but removes edit links from mobile cards, desktop table and detail', () => {
    const list = render()
    expect(list).toContain('href="/profissionais/novo"')
    expect(list).not.toContain('/synthetic-profile/editar')
    const detail = render('/profissionais/synthetic-profile')
    expect(detail).toContain('CRM/UF')
    expect(detail).not.toContain('/synthetic-profile/editar')
    expect(detail).toContain('solicite a alteração ao administrador do sistema')
  })

  it.each(['ADMIN', 'OPHTHALMOLOGIST', 'RECEPTIONIST'] as const)(
    'blocks direct edit URL for %s without rendering an edit form', role => {
      session.role = role
      const html = render('/profissionais/synthetic-profile/editar')
      expect(html).toContain('role="alert"')
      expect(html).toContain(professionalEditDeniedMessage)
      expect(html).toContain('href="/profissionais"')
      expect(html).not.toContain('<form')
      expect(session.update).not.toHaveBeenCalled()
    },
  )

  it.each(['OPHTHALMOLOGIST', 'RECEPTIONIST'] as const)(
    'does not offer creation or edition to %s', role => {
      session.role = role
      const list = render()
      expect(list).not.toContain('href="/profissionais/novo"')
      expect(list).not.toContain('/synthetic-profile/editar')
      expect(render('/profissionais/novo')).not.toContain('<form')
    },
  )

  it('shows the real creation form and explains that later corrections require System Admin', () => {
    const html = render('/profissionais/novo')
    expect(html).toContain('<form')
    expect(html).toContain('correções posteriores são restritas ao administrador do sistema')
    expect(html).toContain('aria-label="Informação administrativa"')
  })

  it('keeps global edit links in both list layouts and renders the real authorized edit form', () => {
    session.isSystemAdmin = true
    const list = render()
    expect(list.match(/href="\/profissionais\/synthetic-profile\/editar"/g)).toHaveLength(2)
    const html = render('/profissionais/synthetic-profile/editar')
    expect(html).toContain('<form')
    expect(html).toContain('Editar profissional')
    expect(html).toContain('Alterações profissionais valem para todas as')
  })

  it('keeps the existing inactive/missing clinic boundary', () => {
    session.role = null
    const html = render('/profissionais/synthetic-profile/editar')
    expect(html).toContain('Selecione uma clínica com vínculo ativo')
    expect(html).not.toContain('<form')
  })
})
