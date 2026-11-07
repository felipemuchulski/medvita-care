import { Temporal } from "temporal-polyfill";

export const calendarTimeZone = "Etc/GMT+3";
export function clinicalDateTime(iso: string) {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(calendarTimeZone)
    .toPlainDateTime()
    .toString()
    .slice(0, 16);
}

export function visiblePeriod(start: string, exclusiveEnd: string) {
  const first = clinicalDateTime(start).slice(0, 10);
  const last = clinicalDateTime(
    new Date(Date.parse(exclusiveEnd) - 1).toISOString(),
  ).slice(0, 10);
  return { first, last };
}

export function creationSelection(iso: string, allDay: boolean) {
  const local = allDay ? iso.slice(0, 10) : clinicalDateTime(iso);
  return { date: local.slice(0, 10), time: allDay ? "" : local.slice(11, 16) };
}
