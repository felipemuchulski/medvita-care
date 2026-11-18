import { useAuthorizedQuery } from '../../../lib/authorized-query'
import { appointmentKeys } from '../../appointments/hooks/use-appointments'
import { defaultOffset, toIso } from '../../appointments/lib/appointment'
import type { AppointmentQuery } from '../../appointments/types/appointment'
import { addDays } from '../utils/calendar'

export { loadAppointmentPeriod as loadCalendarPeriod } from '../../appointments/lib/appointment-period'
import { loadAppointmentPeriod } from '../../appointments/lib/appointment-period'
export function useCalendarAppointments(
  clinic: string,
  first: string,
  last: string,
  filters: AppointmentQuery,
  enabled = true,
) {
  // Include the previous day: appointments can last up to 480 minutes and cross midnight.
  const query = {
    ...filters,
    from: toIso(`${addDays(first, -1)}T00:00`, defaultOffset),
    to: toIso(`${last}T23:59`, defaultOffset).replace(':00-03:00', ':59.999-03:00'),
  }
  return useAuthorizedQuery({
    queryKey: [...appointmentKeys.all(clinic), 'calendar', query],
    queryFn: ({ signal }) => loadAppointmentPeriod(clinic, query, signal),
    enabled: Boolean(clinic) && enabled,
  })
}
