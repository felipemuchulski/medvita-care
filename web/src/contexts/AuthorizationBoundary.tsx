import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useAuth } from '../hooks/use-auth'
import { useClinic } from '../hooks/use-clinic'
import { AuthorizationView } from '../lib/authorized-query'
import { getAuthorization, subscribeAuthorization } from '../lib/authorization-store'
import { AuthContext } from './auth-context'
import { ClinicContext } from './clinic-context'

// Keep a hidden, inert draft until the user explicitly accepts a forced change.
// Frozen provider values prevent role-dependent page keys from destroying it first.
export function AuthorizationBoundary({ children }: { children: ReactNode }) {
  const live = useSyncExternalStore(
    subscribeAuthorization,
    getAuthorization,
    getAuthorization,
  )
  const auth = useAuth(),
    clinic = useClinic()
  const [frame, setFrame] = useState({ scope: live, auth, clinic, children })
  const alertRef = useRef<HTMLElement>(null)
  const identityChanged = frame.scope.identity !== live.identity
  const voluntary = live.reason === 'clinic-selection' && !live.blocked
  const changed = frame.scope.revision !== live.revision
  const paused = live.blocked || (changed && !identityChanged && !voluntary)
  useLayoutEffect(() => {
    if (paused) alertRef.current?.focus()
  }, [paused])
  if (
    !paused &&
    (frame.scope !== live ||
      frame.auth !== auth ||
      frame.clinic !== clinic ||
      frame.children !== children)
  ) {
    setFrame({ scope: live, auth, clinic, children })
  }
  useEffect(() => {
    let dirty = false
    const input = (event: Event) => {
      if ((event.target as HTMLElement).closest('form')) dirty = true
    }
    const leaving = (event: Event) => {
      if (!dirty || event.defaultPrevented || Reflect.get(event, 'medvitaHandled')) return
      Object.defineProperty(event, 'medvitaHandled', { value: true, configurable: true })
      if (!window.confirm('Há dados digitados. Deseja descartá-los e mudar de contexto?'))
        event.preventDefault()
    }
    document.addEventListener('input', input, true)
    document.addEventListener('change', input, true)
    window.addEventListener('medvita:before-clinic-change', leaving)
    window.addEventListener('medvita:before-logout', leaving)
    return () => {
      document.removeEventListener('input', input, true)
      document.removeEventListener('change', input, true)
      window.removeEventListener('medvita:before-clinic-change', leaving)
      window.removeEventListener('medvita:before-logout', leaving)
    }
  }, [frame.scope.revision])
  return (
    <>
      {paused && (
        <section
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          aria-label="Alteração de acesso"
          className="mx-auto w-full max-w-3xl space-y-3 break-words p-4 sm:p-6"
        >
          <p>
            {live.notice || 'Suas permissões mudaram. O contexto anterior foi bloqueado.'}
          </p>
          <p>
            Se havia um formulário aberto, os dados digitados estão ocultos e nenhuma nova
            gravação será permitida. Ao continuar, essa edição será descartada.
          </p>
          <p>
            Se havia uma gravação em andamento, confira o resultado antes de reenviar.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-11 rounded-lg border p-3 disabled:opacity-50"
              disabled={live.blocked}
              onClick={() => setFrame({ scope: live, auth, clinic, children })}
            >
              Descartar edição anterior e continuar
            </button>
            {live.blocked && (
              <button
                className="min-h-11 rounded-lg border p-3"
                onClick={() => void auth.revalidateSession()}
              >
                Verificar acesso novamente
              </button>
            )}
            <a
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg border p-3"
            >
              Ir ao início
            </a>
          </div>
        </section>
      )}
      {!paused && live.notice && (
        <p
          role="status"
          className="break-words p-4"
        >
          {live.notice}
        </p>
      )}
      <div
        key={paused ? frame.scope.revision : live.revision}
        hidden={paused}
        inert={paused}
      >
        <AuthContext.Provider value={paused ? frame.auth : auth}>
          <ClinicContext.Provider value={paused ? frame.clinic : clinic}>
            <AuthorizationView.Provider value={paused ? frame.scope : live}>
              {paused ? frame.children : children}
            </AuthorizationView.Provider>
          </ClinicContext.Provider>
        </AuthContext.Provider>
      </div>
    </>
  )
}
