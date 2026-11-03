import { useContext } from 'react'
import { ClinicContext, type ClinicContextValue } from '../contexts/clinic-context'

export function useClinic(): ClinicContextValue {
  const context = useContext(ClinicContext)
  if (!context) {
    throw new Error('useClinic deve ser usado dentro de ClinicProvider.')
  }
  return context
}
