import { useRef, useState } from 'react'
import { Outlet } from 'react-router'
import Sidebar from './Sidebar'
import Header from './Header'
import { useDesktopLayout } from '../../hooks/use-desktop-layout'

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)
  const desktop = useDesktopLayout()
  if (desktop && isSidebarOpen) setIsSidebarOpen(false)

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <a
        href="#main-content"
        onClick={() => main.current?.focus()}
        className="sr-only z-[100] rounded-lg bg-white p-3 text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o conteúdo principal
      </a>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        returnFocus={() => (desktop ? main.current : menuButton.current)}
      />

      <div className="min-w-0 flex-1">
        <Header
          onOpenMenu={() => setIsSidebarOpen(true)}
          isMenuOpen={isSidebarOpen}
          menuButtonRef={menuButton}
        />

        <main
          id="main-content"
          ref={main}
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-7xl scroll-mt-40 p-4 [overflow-wrap:anywhere] sm:p-6 lg:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
