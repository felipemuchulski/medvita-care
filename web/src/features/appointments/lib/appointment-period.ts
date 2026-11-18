import { ApiError } from '../../../api/api-error'
import { appointmentsApi } from '../api/appointments-api'
import type { Appointment, AppointmentQuery } from '../types/appointment'

// Load a complete, bounded period. Never report a partial page as a total.
export async function loadAppointmentPeriod(
  clinic: string,
  filters: AppointmentQuery,
  signal?: AbortSignal,
) {
  const items = new Map<string, Appointment>()
  let expectedTotal: number | undefined
  for (let page = 1; page <= 100; page++) {
    if (signal?.aborted) throw ApiError.aborted(new Error('Appointment period cancelled'))
    const result = await appointmentsApi.list(
      clinic,
      { ...filters, page, limit: 100 },
      signal,
    )
    if (signal?.aborted) throw ApiError.aborted(new Error('Appointment period cancelled'))
    const { total, totalPages, limit, page: receivedPage } = result.meta
    if (
      !Number.isInteger(total) ||
      total < 0 ||
      total > 10_000 ||
      limit !== 100 ||
      receivedPage !== page ||
      totalPages !== Math.ceil(total / 100) ||
      (expectedTotal !== undefined && expectedTotal !== total)
    ) {
      throw new Error('Appointment period unavailable')
    }
    expectedTotal = total
    for (const item of result.data) {
      if (item.clinicId !== clinic || items.has(item.id))
        throw new Error('Invalid appointment period')
      items.set(item.id, item)
    }
    if (page >= totalPages) {
      if (items.size !== total) throw new Error('Incomplete appointment period')
      return [...items.values()]
    }
  }
  throw new Error('Appointment period exceeds limit')
}
