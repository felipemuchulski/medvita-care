import { KeyRound, LogOut, Menu, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type Ref } from 'react'
import { Link, useLocation } from 'react-router'
import { navigationItems } from '../../app/navigation'
import { useAuth } from '../../hooks/use-auth'
import { useClinic } from '../../hooks/use-clinic'
import {
  sessionGreeting,
  sessionRole,
  selectedClinicName,
} from '../../lib/session-presentation'

interface HeaderProps {
  onOpenMenu: () => void
  isMenuOpen: boolean
  menuButtonRef: Ref<HTMLButtonElement>
}
export default function Header({ onOpenMenu, isMenuOpen, menuButtonRef }: HeaderProps) {
  const location = useLocation()
  const { logout, user } = useAuth()
  const clinic = useClinic()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [openAt, setOpenAt] = useState<string | null>(null)
  const account = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const open = openAt === location.key
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !account.current?.contains(event.target))
        setOpenAt(null)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const currentPage = navigationItems.find(
    (item) =>
      item.path === location.pathname ||
      (item.path !== '/' && location.pathname.startsWith(`${item.path}/`)),
  )
  const title =
    location.pathname === '/usuarios-clinica' ||
    /^\/clinicas\/[^/]+\/usuarios$/.test(location.pathname)
      ? 'Equipe da clínica'
      : location.pathname.startsWith('/minha-clinica') ||
          (currentPage?.path === '/clinicas' && !user?.isSystemAdmin)
        ? 'Minha clínica'
        : location.pathname === '/alterar-senha'
          ? 'Alterar senha'
          : (currentPage?.label ?? 'MedVita Care')
  return (
    <header className="sticky top-0 z-30 min-w-0 border-b border-border bg-white px-3 py-3 sm:px-6">
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menu"
            aria-expanded={isMenuOpen}
            aria-controls="main-sidebar"
            aria-haspopup="dialog"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-primary-dark hover:bg-primary-light lg:hidden"
          >
            <Menu
              size={23}
              aria-hidden="true"
            />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary lg:hidden">MedVita Care</p>
            <h2 className="break-words text-base font-semibold text-text-primary sm:text-lg">
              {title}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div
            ref={account}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpenAt(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && open) {
                event.preventDefault()
                setOpenAt(null)
                trigger.current?.focus()
              }
            }}
          >
            <button
              ref={trigger}
              type="button"
              aria-label={`Conta de ${user?.name?.trim() || 'usuário'}`}
              aria-expanded={open}
              aria-controls="user-card"
              onClick={() => setOpenAt(open ? null : location.key)}
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-sm text-primary hover:bg-primary-light sm:px-3"
            >
              <UserRound
                size={20}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Minha conta</span>
            </button>
            {open && (
              <section
                id="user-card"
                aria-label="Conta do usuário"
                className="absolute right-4 top-full z-50 mt-2 w-[min(20rem,calc(100vw_-_2rem))] space-y-2 rounded-xl border border-border bg-white p-4 shadow-lg [overflow-wrap:anywhere]"
              >
                <p className="font-semibold">{user?.name}</p>
                <p className="text-sm text-text-secondary">
                  {sessionRole(clinic.activeRole, Boolean(user?.isSystemAdmin))}
                </p>
                {user?.isSystemAdmin && clinic.activeRole && (
                  <p className="text-xs text-text-secondary">Administrador do sistema</p>
                )}
                <p className="text-sm">Clínica: {selectedClinicName(clinic)}</p>
                <Link
                  to="/alterar-senha"
                  onClick={() => setOpenAt(null)}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary hover:bg-primary-light"
                >
                  <KeyRound
                    size={18}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  Alterar senha
                </Link>
              </section>
            )}
          </div>
          <button
            type="button"
            disabled={isLoggingOut}
            aria-label={isLoggingOut ? 'Saindo da sessão' : 'Sair da sessão'}
            title="Sair"
            onClick={async () => {
              setIsLoggingOut(true)
              setLogoutError('')
              try {
                await logout()
              } catch {
                setLogoutError('Não foi possível confirmar a saída. Tente novamente.')
              } finally {
                setIsLoggingOut(false)
              }
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut
              size={20}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      <div className="mt-2 grid min-w-0 gap-1 text-sm md:grid-cols-2 md:gap-4 [overflow-wrap:anywhere]">
        <p>
          {sessionGreeting(user?.name)}{' '}
          <span className="text-text-secondary">
            {sessionRole(clinic.activeRole, Boolean(user?.isSystemAdmin))}
          </span>
        </p>
        <p className="text-text-secondary md:text-right">
          Clínica: {selectedClinicName(clinic)}
        </p>
      </div>
      {logoutError && (
        <p
          role="alert"
          className="mt-2 break-words text-sm text-red-800"
        >
          {logoutError}
        </p>
      )}
    </header>
  )
}
