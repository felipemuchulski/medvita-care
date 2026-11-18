import { useRef, useCallback } from 'react'
import { isApiError } from '../api/api-error'

export function focusFormError(form: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    if (!form?.isConnected || form.closest('[hidden], [inert]')) return
    const field =
      form.querySelector<HTMLElement>(
        'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]',
      ) ?? form.querySelector<HTMLElement>('[data-form-errors]')
    field?.focus({ preventScroll: true })
    field?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
  })
}
export function useFormErrorFocus() {
  const formRef = useRef<HTMLFormElement>(null)
  const focusErrors = useCallback(() => focusFormError(formRef.current), [])
  return { formRef, focusErrors }
}
// Known status messages only: validation internals and database details stay out of forms.
export function formApiError(
  error: unknown,
  fallback = 'Não foi possível salvar. Seus dados foram preservados. Tente novamente.',
) {
  if (!isApiError(error)) return fallback
  if (error.code === 'REQUEST_ABORTED')
    return 'A operação foi interrompida porque o contexto de acesso mudou. Confira o resultado antes de tentar novamente.'
  if (error.status === 401)
    return 'A sessão precisa ser verificada. A operação não será reenviada automaticamente; revise antes de tentar novamente.'
  if (error.status === 403) return 'Você não possui permissão para realizar esta ação.'
  if (error.status === 404)
    return 'Registro não encontrado ou não autorizado neste contexto.'
  if (error.status === 409)
    return 'Não foi possível salvar por conflito com os dados atuais. Revise os campos e tente novamente.'
  if ([400, 422].includes(error.status))
    return 'Confira os campos informados e tente novamente. Seus dados foram preservados.'
  if (error.code === 'NETWORK_ERROR')
    return 'Não foi possível conectar ao servidor. Seus dados foram preservados. Verifique sua conexão.'
  return fallback
}
