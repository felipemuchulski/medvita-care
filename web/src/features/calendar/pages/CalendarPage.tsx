import { useId } from "react";
import { useSearchParams } from "react-router";
import { useClinic } from "../../../hooks/use-clinic";
import {
  ProfessionalSelector,
  inputClass,
} from "../../appointments/components/Selectors";
import { canManage, statusLabels } from "../../appointments/lib/appointment";
import type { AppointmentStatus } from "../../appointments/types/appointment";
import { FullCalendarView } from "../components/FullCalendarView";

export default function CalendarPage() {
  const clinic = useClinic();
  if (clinic.isLoading) return <p role="status">Carregando clínica...</p>;
  if (!clinic.activeClinicId || !clinic.activeRole)
    return (
      <p role="alert">
        {clinic.error ||
          "Selecione uma clínica com vínculo ativo para acessar o calendário."}
      </p>
    );
  return (
    <Calendar
      key={`${clinic.activeClinicId}:${clinic.activeRole}`}
      clinic={clinic.activeClinicId}
      manage={canManage(clinic.activeRole)}
    />
  );
}
function Calendar({ clinic, manage }: { clinic: string; manage: boolean }) {
  const statusId = useId();
  const [params, setParams] = useSearchParams();
  const requestedStatus = params.get("status") ?? "";
  const status = Object.hasOwn(statusLabels, requestedStatus)
    ? (requestedStatus as AppointmentStatus)
    : undefined;
  const professionalId = params.get("professional") ?? "";
  function update(values: Record<string, string>) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  }
  return (
    <div className="min-w-0 space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Calendário</h1>
      </header>

      <details className="rounded-xl border border-border bg-white p-4">
        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-primary">
          Filtros{status || professionalId ? " ativos" : ""}
        </summary>
        <div className="grid min-w-0 gap-4 pt-3 md:grid-cols-2">
          <ProfessionalSelector
            clinic={clinic}
            value={professionalId}
            onChange={(id) => update({ professional: id })}
          />
          <div className="min-w-0 space-y-2 md:col-span-2">
            <label htmlFor={statusId} className="block font-medium">Status</label>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <select
                id={statusId}
                className={`${inputClass} flex-1`}
                value={status ?? ""}
                onChange={(e) => update({ status: e.target.value })}
              >
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                className="relative inline-flex h-[30px] shrink-0 items-center justify-center whitespace-nowrap rounded border border-primary bg-white px-2 py-0 text-xs leading-none font-medium text-primary after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-3"
                onClick={() => update({ professional: "", status: "" })}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>
      </details>
      
      <FullCalendarView
        clinic={clinic}
        manage={manage}
        filters={{ professionalId, status }}
      />
    </div>
  );
}
