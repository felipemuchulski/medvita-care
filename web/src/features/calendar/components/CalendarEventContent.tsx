import type { EventDisplayInfo } from '@fullcalendar/react'
import { pendingAppointmentLabel } from '../../appointments/lib/pending-appointment'
export function CalendarEventContent(info: EventDisplayInfo) {
  if (info.view.type === 'dayGridMonth') {
    return (
      <div className="medvita-month-event">
        <span
          className="medvita-month-dot"
          aria-hidden="true"
        >
          ●
        </span>
        {info.event.extendedProps.pendingReview && (
          <span className="block whitespace-normal text-xs leading-tight [overflow-wrap:anywhere]">
            Pendente de revisão
          </span>
        )}
        <span className="medvita-month-label">
          {info.timeText} {info.event.title} · {info.event.extendedProps.statusLabel}
        </span>
      </div>
    )
  }
  return (
    <div className="medvita-event-content">
      <span className="font-semibold">
        {info.timeText} {info.event.title}
      </span>
      <span>{info.event.extendedProps.professional}</span>
      <span>{info.event.extendedProps.statusLabel}</span>
      {info.event.extendedProps.pendingReview && <span>{pendingAppointmentLabel}</span>}
    </div>
  )
}
