import type { AppointmentStatus } from "../types/appointment";
import { statusLabels } from "../lib/appointment";
const colors = {
  SCHEDULED: "bg-blue-50 text-blue-800",
  CONFIRMED: "bg-green-50 text-green-800",
  IN_PROGRESS: "bg-amber-50 text-amber-900",
  COMPLETED: "bg-slate-100 text-slate-800",
  CANCELLED: "bg-red-50 text-red-800",
  NO_SHOW: "bg-purple-50 text-purple-800",
};
export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${colors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
