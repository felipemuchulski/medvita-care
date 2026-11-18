import { formApiError } from '../../../lib/form-feedback'
import { isApiError } from '../../../api/api-error'
export function userError(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 403) return 'Você não tem permissão para executar esta ação.'
    if (error.status === 404)
      return 'Usuário ou vínculo não encontrado no escopo autorizado.'
    return formApiError(error)
  }
  return 'Não foi possível consultar ou salvar os dados. Tente novamente.'
}
