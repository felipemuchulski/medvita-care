import { useAuthorizedQuery, useAuthorizedMutation } from '../../../lib/authorized-query'
import { useQueryClient } from '@tanstack/react-query'
import { examsApi } from '../api/exams-api'
import type {
  CreateExamPayload,
  Exam,
  ExamQuery,
  ExamResultPayload,
  ExamSummary,
  UpdateExamPayload,
} from '../types/exam'
export const examKeys = {
  scope: (clinic: string, user: string) => ['exams', clinic, user] as const,
}
function assertScope<T extends ExamSummary>(exam: T, clinic: string, user: string) {
  if (
    exam.clinicId !== clinic ||
    exam.requestedByProfessional.userId !== user ||
    exam.patient.id !== exam.patientId
  )
    throw new Error('Invalid exam scope')
  return exam
}
export function useExamTypes(clinic: string, user: string) {
  return useAuthorizedQuery({
    queryKey: [...examKeys.scope(clinic, user), 'types'],
    queryFn: ({ signal }) => examsApi.types(clinic, signal),
    gcTime: 0,
  })
}
export function useExams(clinic: string, user: string, query: ExamQuery, enabled = true) {
  return useAuthorizedQuery({
    queryKey: [...examKeys.scope(clinic, user), 'list', query],
    queryFn: async ({ signal }) => {
      const response = await examsApi.list(clinic, query, signal)
      response.data.forEach((exam) => {
        assertScope(exam, clinic, user)
        if (
          (query.patientId && query.patientId !== exam.patientId) ||
          (query.encounterId && query.encounterId !== exam.encounterId)
        )
          throw new Error('Invalid exam association')
      })
      return response
    },
    enabled,
    gcTime: 0,
    staleTime: 0,
  })
}
export function useExam(clinic: string, user: string, id: string) {
  return useAuthorizedQuery({
    queryKey: [...examKeys.scope(clinic, user), 'detail', id],
    queryFn: async ({ signal }) =>
      assertScope(await examsApi.detail(clinic, id, signal), clinic, user),
    enabled: Boolean(id),
    gcTime: 0,
    staleTime: 0,
  })
}
export function useExamMutations(clinic: string, user: string) {
  const cache = useQueryClient()
  const onSuccess = async (exam: Exam) => {
    assertScope(exam, clinic, user)
    // No retained mutation payloads/results after success or leaving the page.
    await cache.invalidateQueries({ queryKey: examKeys.scope(clinic, user) })
  }
  return {
    create: useAuthorizedMutation({
      mutationFn: (payload: CreateExamPayload) => examsApi.create(clinic, payload),
      onSuccess,
      gcTime: 0,
    }),
    update: useAuthorizedMutation({
      mutationFn: ({ id, payload }: { id: string; payload: UpdateExamPayload }) =>
        examsApi.update(clinic, id, payload),
      onSuccess,
      gcTime: 0,
    }),
    result: useAuthorizedMutation({
      mutationFn: ({ id, payload }: { id: string; payload: ExamResultPayload }) =>
        examsApi.result(clinic, id, payload),
      onSuccess,
      gcTime: 0,
    }),
    complete: useAuthorizedMutation({
      mutationFn: (id: string) => examsApi.complete(clinic, id),
      onSuccess,
      gcTime: 0,
    }),
    cancel: useAuthorizedMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        examsApi.cancel(clinic, id, reason),
      onSuccess,
      gcTime: 0,
    }),
  }
}
