
import { Menu } from 'lucide-react'
import { useLocation } from 'react-router'
import { navigationItems } from '../../app/navigation'

interface HeaderProps {
  onOpenMenu: () => void
}

export default function Header({
  onOpenMenu,
}: HeaderProps) {
  const location = useLocation()

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

      <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary-dark">
        MVP
      </span>
    </header>
  )
}
