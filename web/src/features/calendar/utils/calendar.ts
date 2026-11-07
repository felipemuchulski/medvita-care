import {
  defaultOffset,
  localInOffset,
  toIso,
} from "../../appointments/lib/appointment";
export { validDate } from "../../appointments/lib/appointment";
import type { Appointment } from "../../appointments/types/appointment";

export function today() {
  return localInOffset(new Date().toISOString()).slice(0, 10);
}

export function addDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function weekDays(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const monday = addDays(day, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function dayLabel(day: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

export function dayBounds(day: string) {
  const start = Date.parse(toIso(`${day}T00:00`, defaultOffset));
  return { start, end: start + 86400000 };
}

export function appointmentsForDay(items: Appointment[], day: string) {
  const { start, end } = dayBounds(day);
  return items
    .filter(
      (a) => Date.parse(a.scheduledAt) < end && Date.parse(a.endsAt) > start,
    )
    .sort(
      (a, b) =>
        Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
        a.id.localeCompare(b.id),
    );
}


export function hourForDay(a: Appointment, day: string) {
  const { start } = dayBounds(day);
  return Math.max(0, Math.floor((Date.parse(a.scheduledAt) - start) / 3600000));
}

export function visibleHours(items: Appointment[], days: string[]) {
  let first = 24;
  let last = -1;
  for (const day of days) {
    const { start, end } = dayBounds(day);
    for (const a of appointmentsForDay(items, day)) {
      first = Math.min(first, hourForDay(a, day));
      last = Math.max(
        last,
        Math.min(
          23,
          Math.floor(
            (Math.min(Date.parse(a.endsAt), end) - start - 1) / 3600000,
          ),
        ),
      );
    }
  }
  return last < 0
    ? []
    : Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
