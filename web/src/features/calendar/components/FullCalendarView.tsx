import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar, {
  type CalendarRef,
  type DatesSetInfo,
  type DateClickInfo,
} from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import listPlugin from '@fullcalendar/react/list'
import interactionPlugin from '@fullcalendar/react/interaction'
import themePlugin from '@fullcalendar/react/themes/monarch'
import ptBr from '@fullcalendar/react/locales/pt-br'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/monarch/theme.css'
import '@fullcalendar/react/themes/monarch/palettes/blue.css'
import '../styles/calendar.css'
import { useNavigate, useSearchParams } from 'react-router'
import { appointmentError, validDate } from '../../appointments/lib/appointment'
import type { AppointmentQuery } from '../../appointments/types/appointment'
import { useCalendarAppointments } from '../hooks/use-calendar-appointments'
import { useResponsiveCalendar } from '../hooks/use-responsive-calendar'
import { today } from '../utils/calendar'
import { appointmentToEvent } from '../utils/appointmentToEvent'
import {
  calendarTimeZone,
  clinicalDateTime,
  creationSelection,
  visiblePeriod,
} from '../utils/calendarDates'
import { CalendarEventContent } from './CalendarEventContent'
import { CalendarToolbar } from './CalendarToolbar'
import { calendarControl, viewLabels, type CalendarViewName } from '../types/calendar'

const plugins = [
  themePlugin,
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin,
]
const timeFormat = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
} as const

export function FullCalendarView({
  clinic,
  manage,
  filters,
}: {
  clinic: string
  manage: boolean
  filters: AppointmentQuery
}) {
  const ref = useRef<CalendarRef>(null)
  const desktop = useResponsiveCalendar()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [initial] = useState(() => {
    const rawView = params.get('view') ?? ''
    const requested =
      rawView === 'week'
        ? desktop
          ? 'timeGridWeek'
          : 'listWeek'
        : rawView === 'day'
          ? 'listDay'
          : rawView
    const name = Object.hasOwn(viewLabels, requested)
      ? (requested as CalendarViewName)
      : desktop
        ? 'timeGridWeek'
        : 'listDay'
    return {
      date: validDate(params.get('date')) ? params.get('date')! : today(),
      view: !desktop && name === 'timeGridWeek' ? 'listWeek' : name,
    }
  })
  const [period, setPeriod] = useState<{
    first: string
    last: string
    title: string
    date: string
    view: string
  } | null>(null)
  const query = useCalendarAppointments(
    clinic,
    period?.first ?? initial.date,
    period?.last ?? initial.date,
    filters,
    Boolean(period),
  )
  const events = useMemo(
    () =>
      query.isFetching || query.isError ? [] : (query.data ?? []).map(appointmentToEvent),
    [query.data, query.isFetching, query.isError],
  )
  const previousDesktop = useRef(desktop)
  useEffect(() => {
    if (desktop === previousDesktop.current) return
    previousDesktop.current = desktop
    const api = ref.current?.getApi()
    if (!api) return
    if (!desktop && api.view.type === 'timeGridWeek') api.changeView('listWeek')
    else if (desktop && api.view.type.startsWith('list')) api.changeView('timeGridWeek')
  }, [desktop])

  const datesSet = useCallback((info: DatesSetInfo) => {
    const range = visiblePeriod(info.startStr, info.endStr)
    const current = ref.current?.getApi().getDate()
    const date = current
      ? clinicalDateTime(current.toISOString()).slice(0, 10)
      : range.first
    setPeriod((previous) =>
      previous?.first === range.first &&
      previous.last === range.last &&
      previous.view === info.view.type &&
      previous.date === date
        ? previous
        : { ...range, date, title: info.view.title, view: info.view.type },
    )
  }, [])
  useEffect(() => {
    if (
      !period ||
      (params.get('date') === period.date && params.get('view') === period.view)
    )
      return
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('date', period.date)
        next.set('view', period.view)
        return next
      },
      { replace: true },
    )
  }, [period, params, setParams])

  function create(date: string, time = '') {
    if (!manage) return
    navigate('/agendamentos/novo', {
      state: { calendarDate: date, calendarTime: time, calendarClinic: clinic },
    })
  }
  function dateClick(info: DateClickInfo) {
    const selection = creationSelection(info.dateStr, info.allDay)
    if (info.view.type === 'dayGridMonth')
      ref.current
        ?.getApi()
        .changeView(desktop ? 'timeGridDay' : 'listDay', selection.date)
    else create(selection.date, selection.time)
  }
  return (
    <div className="medvita-calendar min-w-0 space-y-4">
      <CalendarToolbar
        title={period?.title ?? ''}
        date={period?.date ?? initial.date}
        view={period?.view ?? initial.view}
        desktop={desktop}
        onPrevious={() => ref.current?.getApi().prev()}
        onNext={() => ref.current?.getApi().next()}
        onToday={() => ref.current?.getApi().gotoDate(today())}
        onDate={(date) => {
          if (validDate(date)) ref.current?.getApi().gotoDate(date)
        }}
        onView={(view) => ref.current?.getApi().changeView(view)}
      />
      {manage && (
        <button
          type="button"
          className={calendarControl}
          onClick={() => create(period?.date ?? initial.date)}
        >
          Novo agendamento
        </button>
      )}
      {query.isFetching && (
        <p role="status">Carregando todos os agendamentos do período...</p>
      )}
      {query.isError && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
        >
          <p>
            Não foi possível carregar o período completo. {appointmentError(query.error)}
          </p>
          <p>Selecione um período menor ou tente novamente.</p>
          <button
            type="button"
            className={calendarControl}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      )}
      <div
        aria-label="Calendário de agendamentos"
        aria-busy={query.isFetching}
        className="min-w-0 rounded-xl border border-border bg-white p-1 sm:p-3"
      >
        <FullCalendar
          ref={ref}
          plugins={plugins}
          locale={ptBr}
          timeZone={calendarTimeZone}
          initialView={initial.view}
          initialDate={initial.date}
          headerToolbar={false}
          height="auto"
          events={events}
          datesSet={datesSet}
          dateClick={dateClick}
          eventContent={CalendarEventContent}
          eventClick={(info) => navigate(`/agendamentos/${info.event.id}`)}
          eventInteractive
          eventDidMount={(info) => {
            info.el.setAttribute(
              'aria-label',
              `${info.timeText} ${info.event.title}, ${info.event.extendedProps.professional}, ${info.event.extendedProps.statusLabel}. Abrir detalhes`,
            )
          }}
          editable={false}
          eventStartEditable={false}
          eventDurationEditable={false}
          selectable={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          scrollTime="07:00:00"
          slotEventOverlap={false}
          eventMinHeight={44}
          dayMaxEvents={desktop ? 2 : 1}
          moreLinkClick={desktop ? 'popover' : 'listDay'}
          eventTimeFormat={timeFormat}
          slotHeaderFormat={timeFormat}
          firstDay={1}
          nowIndicator
          allDaySlot={false}
          noEventsContent={() =>
            query.isFetching
              ? 'Carregando agenda...'
              : query.isError
                ? 'Agenda indisponível. Consulte a mensagem de erro acima.'
                : 'Nenhum agendamento neste período.'
          }
        />
      </div>
    </div>
  )
}
