import { useFormErrorFocus, formApiError } from '../../../lib/form-feedback'
import { useNavigationNotice } from '../../../hooks/use-navigation-notice'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, CalendarDays } from 'lucide-react'
import { isApiError } from '../../../api/api-error'
import { useAuth } from '../../../hooks/use-auth'

interface LoginLocationState {
  from?: {
    pathname: string
    search?: string
    hash?: string
  }
  notice?: string
}

export default function LoginPage() {
  const { formRef, focusErrors } = useFormErrorFocus()
  const notice = useNavigationNotice('notice')
  const [invalidCredentials, setInvalidCredentials] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const locationState = location.state as LoginLocationState | null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setInvalidCredentials(false)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    try {
      await login({ email, password })
      const destination = locationState?.from
        ? `${locationState.from.pathname}${locationState.from.search ?? ''}${locationState.from.hash ?? ''}`
        : '/'
      navigate(destination, { replace: true })
    } catch (requestError: unknown) {
      const status = isApiError(requestError) ? requestError.status : undefined
      setInvalidCredentials(status === 401)
      setError(
        status === 401
          ? 'E-mail ou senha inválidos. Confira os dados e tente novamente.'
          : status === 403
            ? 'O acesso desta conta não está disponível. Contate a administração.'
            : formApiError(requestError, 'Não foi possível entrar. Tente novamente.'),
      )
      focusErrors()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-6 sm:px-6 lg:p-8">
      <div className="grid w-full min-w-0 max-w-5xl overflow-hidden rounded-2xl border border-border bg-white shadow-xl lg:min-h-[620px] lg:grid-cols-2">
        <aside className="hidden flex-col justify-between bg-primary-dark p-12 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-3">
              <Eye size={28} />
            </div>

            <div>
              <h1 className="text-2xl font-bold">MedVita Care</h1>
              <p className="text-sm text-brand-muted">Gestão clínica</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Sua clínica organizada em um só lugar.
            </h2>

            <p className="text-base leading-relaxed text-primary-light">
              Gerencie pacientes, agendamentos, consultas e prontuários em uma plataforma
              desenvolvida para profissionais de oftalmologia.
            </p>

            <div className="flex items-center gap-3 rounded-xl bg-white/10 p-4">
              <CalendarDays size={24} />

              <span className="text-sm">
                Acompanhe consultas e agendamentos de maneira organizada.
              </span>
            </div>
          </div>

          <p className="text-xs text-brand-muted">
            MedVita Care — Sistema de gestão clínica
          </p>
        </aside>

        <main className="flex min-w-0 flex-col justify-center p-4 sm:p-10 lg:p-12">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="rounded-xl bg-primary-light p-3 text-primary-dark">
              <Eye size={28} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-primary-dark">MedVita Care</h1>
              <p className="text-xs text-text-secondary">Gestão clínica</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
              <ShieldCheck size={25} />
            </div>

            <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">
              Acesse sua conta
            </h2>

            <p className="mt-2 text-sm text-text-secondary">
              Informe suas credenciais para acessar o MedVita Care.
            </p>
          </div>

          {notice && (
            <p
              role="status"
              className="mb-5 rounded-lg border border-primary-light bg-primary-light/50 p-3 text-sm text-primary-dark"
            >
              {notice}
            </p>
          )}

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="space-y-5"
            aria-busy={isSubmitting}
          >
            <div className="form-field">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-primary"
              >
                E-mail
              </label>

              <div className="relative">
                <Mail
                  size={19}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                />

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu@email.com"
                  required
                  disabled={isSubmitting}
                  aria-invalid={invalidCredentials}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="min-h-12 w-full rounded-lg border border-control-border bg-white py-3 pl-12 pr-4 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="form-field">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-primary"
              >
                Senha
              </label>

              <div className="relative">
                <LockKeyhole
                  size={19}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  required
                  disabled={isSubmitting}
                  aria-invalid={invalidCredentials}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="min-h-12 w-full rounded-lg border border-control-border bg-white py-3 pl-12 pr-14 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                />

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-text-secondary hover:bg-background hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>

            {error && (
              <p
                id="login-error"
                data-form-errors
                tabIndex={-1}
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </p>
            )}
          </form>

          <p className="mt-10 text-center text-xs text-text-secondary">
            Acesso destinado a profissionais autorizados.
          </p>
        </main>
      </div>
    </div>
  )
}
