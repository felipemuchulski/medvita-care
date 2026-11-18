import { useRef } from 'react'
import { useModalDialog } from '../../hooks/use-modal-dialog'
import { useDesktopLayout } from '../../hooks/use-desktop-layout'
import { canAccessExams, canPreviewExams } from '../../features/exams/lib/exam'
import { Eye, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { navigationItems } from '../../app/navigation'
import { useAuth } from '../../hooks/use-auth'
import {
  canReadClinicalRecords,
  canPreviewClinicalRecords,
} from '../../features/medical-records/lib/encounter'
import { useClinic } from '../../hooks/use-clinic'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  returnFocus?: () => HTMLElement | null
}

export default function Sidebar({ isOpen, onClose, returnFocus }: SidebarProps) {
  const desktop = useDesktopLayout()
  const dialog = useRef<HTMLDialogElement>(null)
  useModalDialog(dialog, isOpen && !desktop, returnFocus)
  return (
    <>
      <aside
        aria-label="Menu principal"
        className="hidden h-dvh w-72 shrink-0 flex-col bg-primary-dark text-white [--focus-ring:var(--color-brand-highlight)] lg:sticky lg:top-0 lg:flex"
      >
        <SidebarContent
          onClose={onClose}
          prefix="desktop"
        />
      </aside>
      <dialog
        ref={dialog}
        id="main-sidebar"
        aria-modal="true"
        aria-label="Menu principal"
        onCancel={(event) => {
          event.preventDefault()
          onClose()
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const r = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose()
        }}
        className="fixed inset-y-0 left-0 m-0 hidden h-dvh max-h-dvh w-[min(20rem,calc(100vw_-_1rem))] max-w-none flex-col border-0 bg-primary-dark p-0 text-white shadow-xl backdrop:bg-slate-950/50 open:flex [--focus-ring:var(--color-brand-highlight)]"
      >
        <SidebarContent
          onClose={onClose}
          prefix="mobile"
          mobile
        />
      </dialog>
    </>
  )
}
function SidebarContent({
  onClose,
  prefix,
  mobile = false,
}: {
  onClose: () => void
  prefix: string
  mobile?: boolean
}) {
  const { user } = useAuth()
  const { memberships, activeClinicId, activeRole, isLoading, error, selectClinic } =
    useClinic()

  return (
    <>
      <div className="flex items-center justify-between px-5 py-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-white/15 p-2">
            <Eye
              size={25}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="break-words text-lg font-bold">MedVita Care</p>
            <p className="text-xs text-brand-muted">Gestão clínica</p>
          </div>
        </div>

        {mobile && (
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
          >
            <X
              size={20}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="border-y border-white/10 px-4 py-4">
        <p
          id={`${prefix}-clinic-label`}
          className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-highlight"
        >
          Clínica ativa
        </p>
        {isLoading ? (
          <p
            className="text-sm text-primary-light"
            role="status"
          >
            Carregando clínicas...
          </p>
        ) : memberships.length > 0 ? (
          <>
            {memberships.length === 1 && activeClinicId ? (
              <p className="flex min-h-11 min-w-0 break-words items-center rounded-lg border border-brand-muted bg-white/10 px-3 py-2 text-sm text-white">
                {memberships[0].clinic?.name ?? memberships[0].clinicId}
              </p>
            ) : (
              <select
                id={`${prefix}-active-clinic`}
                aria-labelledby={`${prefix}-clinic-label`}
                value={activeClinicId ?? ''}
                onChange={(event) => selectClinic(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-brand-muted bg-white/10 px-3 py-2 text-sm text-white focus:border-white focus:ring-2 focus:ring-brand-highlight"
              >
                <option
                  value=""
                  disabled
                  className="text-slate-900"
                >
                  Selecione uma clínica
                </option>

                {memberships.map((membership) => (
                  <option
                    key={membership.clinicId}
                    value={membership.clinicId}
                    className="text-slate-900"
                  >
                    {membership.clinic?.name ?? membership.clinicId}
                  </option>
                ))}
              </select>
            )}
          </>
        ) : (
          <p className="text-sm text-primary-light">Nenhuma clínica autorizada.</p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-200"
          >
            {error}
          </p>
        )}
      </div>

      <nav
        aria-label="Navegação principal"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
      >
        <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-brand-highlight">
          Menu principal
        </p>

        <div className="space-y-1">
          {navigationItems
            .filter(
              (item) =>
                (item.path !== '/exames' ||
                  canAccessExams(activeRole) ||
                  canPreviewExams(activeRole, user?.isSystemAdmin)) &&
                (item.path !== '/prontuarios' ||
                  canReadClinicalRecords(activeRole) ||
                  canPreviewClinicalRecords(activeRole, user?.isSystemAdmin)),
            )
            .map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.path}
                  to={
                    item.path === '/usuarios' && !user?.isSystemAdmin
                      ? '/usuarios-clinica'
                      : item.path
                  }
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex min-h-11 items-center gap-3 rounded-lg
                    px-4 py-3 text-sm font-medium
                    transition-colors
                    ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-primary-light hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <Icon
                    size={19}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {item.path === '/usuarios' && !user?.isSystemAdmin
                      ? 'Equipe da clínica'
                      : item.path === '/clinicas' && !user?.isSystemAdmin
                        ? 'Minha clínica'
                        : item.label}
                  </span>
                </NavLink>
              )
            })}
        </div>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-xs text-brand-muted">MedVita Care • MVP</p>
      </div>
    </>
  )
}
