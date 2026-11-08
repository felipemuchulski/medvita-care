import { KeyRound, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { navigationItems } from '../../app/navigation'
import { useAuth } from '../../hooks/use-auth'

interface HeaderProps {
  onOpenMenu: () => void
}

export default function Header({ onOpenMenu }: HeaderProps) {
  const location = useLocation()
  const { logout, user } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isUserCardOpen, setIsUserCardOpen] = useState(false)

  const currentPage = navigationItems.find(
    (item) =>
      item.path === location.pathname ||
      (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)),
  )

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          aria-controls="main-sidebar"
          className="rounded-lg p-2 text-primary-dark hover:bg-primary-light lg:hidden"
        >
          <Menu size={23} />
        </button>

        <h2 className="text-lg font-semibold text-text-primary">
          {location.pathname === '/usuarios-clinica' ||
          /^\/clinicas\/[^/]+\/usuarios$/.test(location.pathname)
            ? 'Equipe da clínica'
            : location.pathname.startsWith('/minha-clinica') ||
                (currentPage?.path === '/clinicas' && !user?.isSystemAdmin)
              ? 'Minha clínica'
              : (currentPage?.label ?? 'Medvita Care')}
        </h2>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div
          className="relative"
          onMouseEnter={() => setIsUserCardOpen(true)}
          onMouseLeave={() => setIsUserCardOpen(false)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsUserCardOpen(false)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsUserCardOpen(false)
            }
          }}
        >
          <button
            type="button"
            aria-expanded={isUserCardOpen}
            aria-controls="user-card"
            onClick={() => setIsUserCardOpen(true)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-primary hover:bg-primary-light"
          >
            {' '}
            Olá!, {user?.name}
          </button>

          {isUserCardOpen && (
            <div
              id="user-card"
              className="absolute right-0 top-full z-50 w-72 pt-2"
            >
              <div className="rounded-xl border border-border bg-white p-4 shadow-lg">
                <p className="wrap-break-words font-semibold text-text-primary">
                  {user?.name}
                </p>

                <p className="mt-1 wrap-break-words text-sm text-text-secondary">
                  {user?.email}
                </p>

                <Link
                  to="/alterar-senha"
                  onClick={() => setIsUserCardOpen(false)}
                  className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary hover:bg-primary-light"
                >
                  <KeyRound size={18} />
                  Alterar senha de usuário
                </Link>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isLoggingOut}
          aria-label="Sair da sessão"
          title="Sair"
          onClick={async () => {
            setIsLoggingOut(true)
            try {
              await logout()
            } finally {
              setIsLoggingOut(false)
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
        >
          <LogOut size={19} />
        </button>
      </div>
    </header>
  )
}
