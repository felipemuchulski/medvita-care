import { useAuthorizedQuery } from '../../../lib/authorized-query'
import { appointmentsApi } from '../../appointments/api/appointments-api'
import { appointmentKeys } from '../../appointments/hooks/use-appointments'
import { defaultOffset, toIso } from '../../appointments/lib/appointment'
import type { Appointment, AppointmentQuery } from '../../appointments/types/appointment'
import { addDays } from '../utils/calendar'

export async function loadCalendarPeriod(
  clinic: string,
  filters: AppointmentQuery,
  signal?: AbortSignal,
) {
  const items = new Map<string, Appointment>()
  for (let page = 1; page <= 100; page++) {
    const result = await appointmentsApi.list(
      clinic,
      { ...filters, page, limit: 100 },
      signal,
    )
    for (const item of result.data) {
      if (item.clinicId !== clinic) throw new Error('Invalid clinic response')
      items.set(item.id, item)
    }
    if (page >= result.meta.totalPages) {
      if (items.size !== result.meta.total)
        throw new Error('Calendar changed during pagination')
      return [...items.values()]
    }
  }
  throw new Error('Calendar period exceeds load limit')
}
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
    queryFn: ({ signal }) => loadCalendarPeriod(clinic, query, signal),
    enabled: Boolean(clinic) && enabled,
  })
}
