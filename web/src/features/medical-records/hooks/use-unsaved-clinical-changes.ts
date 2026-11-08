import { useEffect } from 'react'
import { useBlocker } from 'react-router'
export function useUnsavedClinicalChanges(dirty: boolean, saving: boolean) {
  const blocker = useBlocker(dirty || saving)
  useEffect(() => {
    if (!dirty && !saving) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const changeContext = (event: Event) => {
      if (
        saving ||
        !window.confirm(
          'Há alterações clínicas não salvas. Deseja descartá-las e continuar?',
        )
      )
        event.preventDefault()
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('medvita:before-clinic-change', changeContext)
    window.addEventListener('medvita:before-logout', changeContext)
    return () => {
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('medvita:before-clinic-change', changeContext)
      window.removeEventListener('medvita:before-logout', changeContext)
    }
  }, [dirty, saving])
  return blocker
}
