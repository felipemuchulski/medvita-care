import { useEffect } from 'react'
import { useBlocker } from 'react-router'
export function useUnsavedClinicalChanges(
  dirty: boolean,
  saving: boolean,
  message = 'Há alterações clínicas não salvas. Deseja descartá-las e continuar?',
  completed?: () => boolean,
) {
  const blocker = useBlocker(() => !completed?.() && (dirty || saving))
  useEffect(() => {
    if (!dirty && !saving) return
    const unload = (event: BeforeUnloadEvent) => {
      if (completed?.()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const changeContext = (event: Event) => {
      if (completed?.()) return
      if (event.defaultPrevented) return
      if (saving) {
        event.preventDefault()
        return
      }
      if (Reflect.get(event, 'medvitaHandled')) return
      Object.defineProperty(event, 'medvitaHandled', { value: true, configurable: true })
      if (saving || !window.confirm(message)) event.preventDefault()
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('medvita:before-clinic-change', changeContext)
    window.addEventListener('medvita:before-logout', changeContext)
    return () => {
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('medvita:before-clinic-change', changeContext)
      window.removeEventListener('medvita:before-logout', changeContext)
    }
  }, [dirty, saving, message, completed])
  return blocker
}
