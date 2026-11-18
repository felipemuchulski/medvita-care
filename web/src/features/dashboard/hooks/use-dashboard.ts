import { useAuthorizedQuery } from '../../../lib/authorized-query'
import { appointmentKeys } from '../../appointments/hooks/use-appointments'
import { loadAppointmentPeriod } from '../../appointments/lib/appointment-period'
import { dashboardAppointment, dashboardPeriod } from '../lib/dashboard'
import type { ClinicRole } from '../../auth/types/auth'

export function useDashboard(
  clinic: string,
  user: string,
  role: ClinicRole,
  now: number,
) {
  const { from, to } = dashboardPeriod(now)
  return useAuthorizedQuery({
    queryKey: [...appointmentKeys.all(clinic), 'dashboard', user, role, { from, to }],
    queryFn: async ({ signal }) => {
      const rows = await loadAppointmentPeriod(clinic, { from, to }, signal)
      return rows.map((row) => {
        if (
          Date.parse(row.scheduledAt) < Date.parse(from) ||
          Date.parse(row.scheduledAt) > Date.parse(to)
        )
          throw new Error('Invalid dashboard period')
        return dashboardAppointment(row, clinic, user, role)
      })
    },
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
