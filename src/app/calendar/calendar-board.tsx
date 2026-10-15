"use client";

import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { rescheduleAppointment, scheduleAppointment } from "~/app/calendar/actions";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  atHour,
  eventsOnDay,
  formatDayHeading,
  formatHour,
  formatRangeHeading,
  formatTime,
  formatYmd,
  hourOf,
  hourSlots,
  keepTimeOnDay,
  monthGrid,
  shiftCursor,
  weekDays,
  type CalendarEvent,
  type CalendarView,
} from "~/lib/calendar-dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarBoard({
  view,
  date,
  events,
  note,
  loadError,
}: {
  view: CalendarView;
  date: string;
  events: CalendarEvent[];
  note?: string;
  loadError?: string;
}) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [selected, setSelected] = useState(date);
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSelected(date);
  }, [date]);

  function href(next: { view?: CalendarView; date?: string }) {
    const params = new URLSearchParams({
      view: next.view ?? view,
      date: next.date ?? date,
    });
    return `/calendar?${params}`;
  }

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null;
    const activeId = String(event.active.id);
    if (!overId || !activeId.startsWith("event:")) return;
    const item = events.find((entry) => entry.id === activeId.slice("event:".length));
    if (!item || item.allDay) return;

    const start = new Date(item.start);
    const end = new Date(item.end);
    const duration = Math.max(end.getTime() - start.getTime(), 30 * 60 * 1000);
    const nextStart = overId.startsWith("day:")
      ? keepTimeOnDay(start, overId.slice("day:".length))
      : overId.startsWith("slot:")
        ? slotStart(overId)
        : null;
    if (!nextStart || nextStart.getTime() === start.getTime()) return;

    startTransition(async () => {
      const result = await rescheduleAppointment({
        id: item.id,
        start: nextStart.toISOString(),
        end: new Date(nextStart.getTime() + duration).toISOString(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  function onCreate(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const data = new FormData(form);
    const title = formText(data, "title");
    const time = formText(data, "time", "09:00");
    const durationMinutes = Number(data.get("duration")) === 60 ? 60 : 30;
    const [hours, minutes] = time.split(":").map(Number);
    const start = atHour(selected, hours ?? 9);
    start.setMinutes(minutes ?? 0);

    startTransition(async () => {
      const result = await scheduleAppointment({
        title,
        start: start.toISOString(),
        durationMinutes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      form.reset();
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {note ?? "Appointments on your Google Calendar. Drag one to reschedule."}
          </p>
        </div>
        <Card className="w-full lg:max-w-sm">
          <CardHeader>
            <CardTitle>New appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                Title
                <input
                  name="title"
                  required
                  maxLength={200}
                  className="h-9 rounded-lg border bg-background px-3"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm">
                  Time
                  <input
                    name="time"
                    type="time"
                    defaultValue="09:00"
                    required
                    className="h-9 rounded-lg border bg-background px-3"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Length
                  <select name="duration" defaultValue="30" className="h-9 rounded-lg border bg-background px-3">
                    <option value="30">30 min</option>
                    <option value="60">60 min</option>
                  </select>
                </label>
              </div>
              <p className="text-sm text-muted-foreground">{formatDayHeading(selected)}</p>
              <Button type="submit" disabled={pending}>
                Schedule
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href({ date: shiftCursor(view, date, -1) })} className={buttonVariants({ variant: "outline" })}>
            Previous
          </Link>
          <Link href={href({ date: formatYmd(new Date()) })} className={buttonVariants({ variant: "outline" })}>
            Today
          </Link>
          <Link href={href({ date: shiftCursor(view, date, 1) })} className={buttonVariants({ variant: "outline" })}>
            Next
          </Link>
        </div>
        <h2 className="text-lg font-medium">{formatRangeHeading(view, date)}</h2>
        <div className="flex items-center gap-2">
          {(["month", "week", "day"] as const).map((item) => (
            <Link
              key={item}
              href={href({ view: item })}
              className={buttonVariants({ variant: item === view ? "default" : "outline" })}
              aria-current={item === view ? "page" : undefined}
            >
              {item === "month" ? "Month" : item === "week" ? "Week" : "Day"}
            </Link>
          ))}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <DndContext id="clinic-calendar" sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
        <div className={`mt-4 ${pending ? "opacity-70" : ""}`}>
          {view === "month" ? (
            <MonthView
              date={date}
              selected={selected}
              events={events}
              onSelect={setSelected}
              onOpen={setOpenEvent}
            />
          ) : (
            <TimeGrid
              days={view === "week" ? weekDays(date) : [date]}
              selected={selected}
              events={events}
              onSelect={setSelected}
              onOpen={setOpenEvent}
            />
          )}
        </div>
      </DndContext>
      {openEvent ? <AppointmentModal event={openEvent} onClose={() => setOpenEvent(null)} /> : null}
    </main>
  );
}

function formText(data: FormData, key: string, fallback = "") {
  const value = data.get(key);
  return typeof value === "string" ? value : fallback;
}

function slotStart(overId: string) {
  const [ymd, hour] = overId.slice("slot:".length).split("@");
  if (!ymd || !hour) return null;
  return atHour(ymd, Number(hour));
}

function MonthView({
  date,
  selected,
  events,
  onSelect,
  onOpen,
}: {
  date: string;
  selected: string;
  events: CalendarEvent[];
  onSelect: (ymd: string) => void;
  onOpen: (event: CalendarEvent) => void;
}) {
  const days = monthGrid(date);
  const month = date.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-7 border-b bg-muted text-xs text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((ymd) => (
          <DayCell
            key={ymd}
            ymd={ymd}
            muted={!ymd.startsWith(month)}
            selected={ymd === selected}
            events={eventsOnDay(events, ymd)}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  ymd,
  muted,
  selected,
  events,
  onSelect,
  onOpen,
}: {
  ymd: string;
  muted: boolean;
  selected: boolean;
  events: CalendarEvent[];
  onSelect: (ymd: string) => void;
  onOpen: (event: CalendarEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${ymd}` });
  const today = ymd === formatYmd(new Date());

  return (
    <div
      ref={setNodeRef}
      className={`min-h-28 border-r border-b p-1 ${muted ? "bg-muted/40" : ""} ${isOver ? "bg-accent" : ""} ${selected ? "ring-1 ring-primary ring-inset" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSelect(ymd)}
        className={`mb-1 px-1 text-xs ${today ? "font-semibold text-primary" : "text-muted-foreground"}`}
      >
        {Number(ymd.slice(-2))}
      </button>
      <div className="grid gap-1">
        {events.map((event) => (
          <EventChip key={event.id} event={event} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  selected,
  events,
  onSelect,
  onOpen,
}: {
  days: string[];
  selected: string;
  events: CalendarEvent[];
  onSelect: (ymd: string) => void;
  onOpen: (event: CalendarEvent) => void;
}) {
  const hours = hourSlots();

  return (
    <div className="overflow-x-auto rounded-xl border">
      <div
        className="grid min-w-[40rem]"
        style={{ gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="border-b bg-muted" />
        {days.map((ymd) => {
          const allDay = eventsOnDay(events, ymd).filter((event) => event.allDay);
          return (
            <div key={ymd} className={`border-b border-l bg-muted px-2 py-2 ${ymd === selected ? "text-primary" : ""}`}>
              <button type="button" onClick={() => onSelect(ymd)} className="text-sm font-medium">
                {formatDayHeading(ymd)}
              </button>
              {allDay.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpen(event)}
                  className="mt-1 w-full truncate text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  {event.title}
                </button>
              ))}
            </div>
          );
        })}
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-b px-2 py-3 text-xs text-muted-foreground">{formatHour(hour)}</div>
            {days.map((ymd) => (
              <HourCell
                key={`${ymd}-${hour}`}
                ymd={ymd}
                hour={hour}
                events={eventsOnDay(events, ymd).filter((event) => !event.allDay && hourOf(event) === hour)}
                onOpen={onOpen}
              />
            ))}
          </div>
        ))}
      </div>
      <OutsideHours days={days} events={events} onOpen={onOpen} />
    </div>
  );
}

function OutsideHours({
  days,
  events,
  onOpen,
}: {
  days: string[];
  events: CalendarEvent[];
  onOpen: (event: CalendarEvent) => void;
}) {
  const outside = days.flatMap((ymd) =>
    eventsOnDay(events, ymd).filter((event) => !event.allDay && hourOf(event) === null),
  );
  if (outside.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
      <span>Outside 8 AM–6 PM:</span>
      {outside.map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onOpen(event)}
          className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
        >
          {event.title} {formatTime(event.start)}
        </button>
      ))}
    </div>
  );
}

function HourCell({
  ymd,
  hour,
  events,
  onOpen,
}: {
  ymd: string;
  hour: number;
  events: CalendarEvent[];
  onOpen: (event: CalendarEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${ymd}@${hour}` });
  return (
    <div ref={setNodeRef} className={`min-h-14 border-b border-l p-1 ${isOver ? "bg-accent" : ""}`}>
      {events.map((event) => (
        <EventChip key={event.id} event={event} detailed onOpen={onOpen} />
      ))}
    </div>
  );
}

function EventChip({
  event,
  detailed = false,
  onOpen,
}: {
  event: CalendarEvent;
  detailed?: boolean;
  onOpen: (event: CalendarEvent) => void;
}) {
  if (event.allDay) {
    return (
      <button
        type="button"
        onClick={() => onOpen(event)}
        className="w-full truncate rounded-md bg-secondary px-1.5 py-0.5 text-left text-xs"
      >
        {event.title}
      </button>
    );
  }

  return <TimedEventChip event={event} detailed={detailed} onOpen={onOpen} />;
}

function TimedEventChip({
  event,
  detailed,
  onOpen,
}: {
  event: CalendarEvent;
  detailed: boolean;
  onOpen: (event: CalendarEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event:${event.id}`,
  });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  function onPointerDown(pointerEvent: ReactPointerEvent<HTMLButtonElement>) {
    pointerStart.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
    listeners?.onPointerDown?.(pointerEvent);
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={`w-full truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-left text-xs text-primary ${isDragging ? "z-10 opacity-70" : ""}`}
      {...listeners}
      {...attributes}
      onPointerDown={onPointerDown}
      onClick={(clickEvent) => {
        const origin = pointerStart.current;
        pointerStart.current = null;
        if (origin) {
          const moved = Math.hypot(clickEvent.clientX - origin.x, clickEvent.clientY - origin.y);
          if (moved > 6) return;
        }
        onOpen(event);
      }}
    >
      {detailed ? `${formatTime(event.start)} ` : null}
      {event.title}
    </button>
  );
}

function AppointmentModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const details = event.appointment;

  useEffect(() => {
    panelRef.current?.focus();
    function onKey(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <Card
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-dialog-title"
        tabIndex={-1}
        className="max-h-[min(32rem,calc(100vh-2rem))] w-full max-w-md outline-none"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <CardHeader>
          <CardTitle id="appointment-dialog-title">{event.title}</CardTitle>
          <CardAction>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid min-h-0 gap-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{formatAppointmentWhen(event)}</p>
          {details ? (
            <dl className="grid gap-3 text-sm">
              <Detail label="Type">{details.appointmentType}</Detail>
              <Detail label="Status">{labelStatus(details.status)}</Detail>
              <Detail label="Length">{details.durationMinutes} min</Detail>
              <Detail label="Patient">
                <Link href={`/patients/${details.patientId}`} className="text-primary hover:underline">
                  {details.patientName}
                </Link>
              </Detail>
              <Detail label="Provider">{details.providerName}</Detail>
              {details.nurseName ? <Detail label="Nurse">{details.nurseName}</Detail> : null}
              {details.reasonForVisit ? <Detail label="Reason">{details.reasonForVisit}</Detail> : null}
              {details.description ? <Detail label="Notes">{details.description}</Detail> : null}
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="leading-6">{children}</dd>
    </div>
  );
}

function formatAppointmentWhen(event: CalendarEvent) {
  const start = new Date(event.start);
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(start);
  if (event.allDay) return `${date} · All day`;
  return `${date} · ${formatTime(event.start)} – ${formatTime(event.end)}`;
}

function labelStatus(status: string) {
  if (status.length === 0) return status;
  return status.charAt(0).toUpperCase() + status.slice(1);
}
