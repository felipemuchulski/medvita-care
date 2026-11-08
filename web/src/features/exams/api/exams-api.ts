import { httpClient } from '../../../api/http-client'
import type {
  CreateExamPayload,
  Exam,
  ExamListResponse,
  ExamQuery,
  ExamResultPayload,
  ExamType,
  UpdateExamPayload,
} from '../types/exam'
const base = (clinic: string) => `/clinics/${clinic}/exams`
export const examsApi = {
  types: (clinic: string, signal?: AbortSignal) =>
    httpClient.get<ExamType[]>(`${base(clinic)}/types`, { signal }),
  list: (clinic: string, query: ExamQuery, signal?: AbortSignal) =>
    httpClient.get<ExamListResponse>(base(clinic), { query: { ...query }, signal }),
  detail: (clinic: string, id: string, signal?: AbortSignal) =>
    httpClient.get<Exam>(`${base(clinic)}/${id}`, { signal }),
  create: (clinic: string, payload: CreateExamPayload) =>
    httpClient.post<Exam>(base(clinic), payload),
  update: (clinic: string, id: string, payload: UpdateExamPayload) =>
    httpClient.patch<Exam>(`${base(clinic)}/${id}`, payload),
  result: (clinic: string, id: string, payload: ExamResultPayload) =>
    httpClient.patch<Exam>(`${base(clinic)}/${id}/result`, payload),
  complete: (clinic: string, id: string) =>
    httpClient.patch<Exam>(`${base(clinic)}/${id}/complete`),
  cancel: (clinic: string, id: string, reason: string) =>
    httpClient.patch<Exam>(`${base(clinic)}/${id}/cancel`, { reason }),
}
