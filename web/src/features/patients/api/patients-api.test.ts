import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '../../../api/http-client'
import { patientsApi } from './patients-api'

afterEach(() => vi.restoreAllMocks())

describe('patientsApi', () => {
  it('mantém clinicId no caminho e envia somente filtros suportados', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })
    await patientsApi.list('clinic-1', { page: 1, limit: 20, search: 'Maria', active: true })
    expect(get).toHaveBeenCalledWith('/clinics/clinic-1/patients', { query: { page: 1, limit: 20, search: 'Maria', active: true } })
  })

  it('usa PATCH específico para status', async () => {
    const patch = vi.spyOn(httpClient, 'patch').mockResolvedValue({ id: 'patient-1', active: false })
    await patientsApi.updateActive('clinic-1', 'patient-1', false)
    expect(patch).toHaveBeenCalledWith('/clinics/clinic-1/patients/patient-1/active', { active: false })
  })
})
