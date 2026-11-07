import type { EventDisplayInfo } from "@fullcalendar/react";
export function CalendarEventContent(info: EventDisplayInfo) {
  if (info.view.type === "dayGridMonth") {
    return (
      <div className="medvita-month-event">
        <span className="medvita-month-dot" aria-hidden="true">
          ●
        </span>
        <span className="medvita-month-label">
          {info.timeText} {info.event.title} ·{" "}
          {info.event.extendedProps.statusLabel}
        </span>
      </div>
    );
  }
  return (
    <div className="medvita-event-content">
      <span className="font-semibold">
        {info.timeText} {info.event.title}
      </span>
      <span>{info.event.extendedProps.professional}</span>
      <span>{info.event.extendedProps.statusLabel}</span>
    </div>
  );
}
