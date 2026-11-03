
import { KeyRound, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { navigationItems } from '../../app/navigation'
import { useAuth } from '../../hooks/use-auth'

interface HeaderProps {
  onOpenMenu: () => void
}

export default function Header({
  onOpenMenu,
}: HeaderProps) {
  const location = useLocation()
  const { logout, user } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const currentPage = navigationItems.find(
    (item) => item.path === location.pathname
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
          {currentPage?.label ?? 'Medvita Care'}
        </h2>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <span className="hidden max-w-48 truncate text-sm text-text-secondary xl:inline">
          {user?.name}
        </span>

        <Link
          to="/alterar-senha"
          aria-label="Alterar senha"
          title="Alterar senha"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition hover:bg-primary-light hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <KeyRound size={19} />
        </Link>

        <button
          type="button"
          disabled={isLoggingOut}
          aria-label="Sair da sessão"
          title="Sair"
          onClick={async () => {
            setIsLoggingOut(true)
            await logout()
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
        >
          <LogOut size={19} />
        </button>
      </div>
    </header>
  )
}
