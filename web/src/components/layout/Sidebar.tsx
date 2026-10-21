
import { Eye, X } from 'lucide-react'
import { NavLink } from 'react-router'
import { navigationItems } from '../../app/navigation'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
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
              <h1 className="text-lg font-bold">
                Medvita Care
              </h1>
              <p className="text-xs text-blue-200">
                Gestão clínica
              </p>
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

        <nav
          aria-label="Navegação principal"
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-blue-300">
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
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
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
          <p className="text-xs text-blue-200">
            Medvita Care • MVP
          </p>
        </div>
      </aside>
    </>
  )
}
