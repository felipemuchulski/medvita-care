import { Eye, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { navigationItems } from '../../app/navigation'
import { useClinic } from '../../hooks/use-clinic'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { memberships, activeClinicId, isLoading, error, selectClinic } = useClinic()

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="main-sidebar"
        className={`
          fixed inset-y-0 left-0 z-50
          flex w-72 shrink-0 flex-col
          bg-primary-dark text-white
          shadow-xl transition-transform duration-200
          lg:sticky lg:top-0 lg:h-screen
          lg:translate-x-0 lg:shadow-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-2">
              <Eye size={25} />
            </div>

            <div>
              <h1 className="text-lg font-bold">Medvita Care</h1>
              <p className="text-xs text-brand-muted">Gestão clínica</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-y border-white/10 px-4 py-4">
          <label
            htmlFor="active-clinic"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-highlight"
          >
            Clínica ativa
          </label>
          {isLoading ? (
            <p
              className="text-sm text-primary-light"
              role="status"
            >
              Carregando clínicas...
            </p>
          ) : memberships.length > 0 ? (
            <>
              {memberships.length === 1 ? (
                <p className="flex min-h-11 items-center rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
                  {memberships[0].clinic?.name ?? memberships[0].clinicId}
                </p>
              ) : (
                <select
                  id="active-clinic"
                  value={activeClinicId ?? ''}
                  onChange={(event) => selectClinic(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none  focus:border-white focus:ring-2 focus:ring-white/30"
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
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-brand-highlight">
            Menu principal
          </p>

          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex items-center gap-3 rounded-lg
                    px-4 py-3 text-sm font-medium
                    transition-colors
                    ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-primary-light hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-xs text-brand-muted">Medvita Care • MVP</p>
        </div>
      </aside>
    </>
  )
}
