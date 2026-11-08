import { useState } from 'react'
import { useNavigate } from 'react-router'
import { isApiError } from '../../../api/api-error'
import { useAuth } from '../../../hooks/use-auth'

export default function ChangePasswordPage() {
  const { changePassword } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)
    const currentPassword = String(formData.get('currentPassword') ?? '')
    const newPassword = String(formData.get('newPassword') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não corresponde.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword({ currentPassword, newPassword })
      navigate('/login', {
        replace: true,
        state: { notice: 'Senha alterada. Entre novamente para continuar.' },
      })
    } catch (requestError: unknown) {
      setError(
        isApiError(requestError)
          ? requestError.message
          : 'Não foi possível alterar a senha.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClassName =
    'min-h-12 w-full rounded-lg border border-border bg-white px-4 py-3 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60'

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Alterar senha</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Após a alteração, todas as sessões serão encerradas.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
        className="space-y-5 rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-2">
          <label
            htmlFor="currentPassword"
            className="block text-sm font-medium"
          >
            Senha atual
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium"
          >
            Nova senha
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={255}
            disabled={isSubmitting}
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium"
          >
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={255}
            disabled={isSubmitting}
            className={inputClassName}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? 'Alterando...' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  )
}
