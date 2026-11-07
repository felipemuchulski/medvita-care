export const calendarControl =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-primary bg-white px-3 py-2 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";
export const viewLabels = {
  dayGridMonth: "Mês",
  timeGridWeek: "Semana",
  timeGridDay: "Dia",
  listDay: "Lista do dia",
  listWeek: "Lista da semana",
};
export type CalendarViewName = keyof typeof viewLabels;
