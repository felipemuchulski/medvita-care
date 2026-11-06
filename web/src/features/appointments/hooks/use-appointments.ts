import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi } from "../api/appointments-api";
import type {
  AppointmentPayload,
  AppointmentQuery,
} from "../types/appointment";
export const appointmentKeys = {
  all: (clinic: string) => ["appointments", clinic] as const,
  list: (clinic: string, query: AppointmentQuery) =>
    ["appointments", clinic, "list", query] as const,
  detail: (clinic: string, id: string) =>
    ["appointments", clinic, "detail", id] as const,
};
export function useAppointments(clinic: string, query: AppointmentQuery) {
  return useQuery({
    queryKey: appointmentKeys.list(clinic, query),
    queryFn: ({ signal }) => appointmentsApi.list(clinic, query, signal),
    enabled: !!clinic,
  });
}
export function useAppointment(clinic: string, id: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(clinic, id),
    queryFn: ({ signal }) => appointmentsApi.detail(clinic, id, signal),
    enabled: !!clinic && !!id,
  });
}
export function useAppointmentMutations(clinic: string) {
  const cache = useQueryClient();
  const options = {
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: appointmentKeys.all(clinic) });
    },
  };
  const create = useMutation({
    mutationFn: (payload: AppointmentPayload) =>
      appointmentsApi.create(clinic, payload),
    ...options,
  });
  const reschedule = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      scheduledAt: string;
      durationMinutes: number;
    }) => appointmentsApi.reschedule(clinic, id, payload),
    ...options,
  });
  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      appointmentsApi.cancel(clinic, id, reason),
    ...options,
  });
  return { create, reschedule, cancel };
}
