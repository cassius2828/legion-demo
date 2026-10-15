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
import { useEffect, useState, useTransition, type FormEvent } from "react";

import { rescheduleAppointment, scheduleAppointment } from "~/app/calendar/actions";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
        <div className={`mt-4 ${pending ? "opacity-70" : ""}`}>
          {view === "month" ? (
            <MonthView date={date} selected={selected} events={events} onSelect={setSelected} />
          ) : (
            <TimeGrid days={view === "week" ? weekDays(date) : [date]} selected={selected} events={events} onSelect={setSelected} />
          )}
        </div>
      </DndContext>
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
}: {
  date: string;
  selected: string;
  events: CalendarEvent[];
  onSelect: (ymd: string) => void;
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
}: {
  ymd: string;
  muted: boolean;
  selected: boolean;
  events: CalendarEvent[];
  onSelect: (ymd: string) => void;
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
          <EventChip key={event.id} event={event} />
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
}: {
  days: string[];
  selected: string;
  events: CalendarEvent[];
  onSelect: (ymd: string) => void;
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
                <p key={event.id} className="mt-1 truncate text-xs text-muted-foreground">
                  {event.title}
                </p>
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
              />
            ))}
          </div>
        ))}
      </div>
      <OutsideHours days={days} events={events} />
    </div>
  );
}

function OutsideHours({ days, events }: { days: string[]; events: CalendarEvent[] }) {
  const outside = days.flatMap((ymd) =>
    eventsOnDay(events, ymd).filter((event) => !event.allDay && hourOf(event) === null),
  );
  if (outside.length === 0) return null;
  return (
    <div className="border-t px-3 py-2 text-sm text-muted-foreground">
      Outside 8 AM–6 PM: {outside.map((event) => `${event.title} ${formatTime(event.start)}`).join(", ")}
    </div>
  );
}

function HourCell({ ymd, hour, events }: { ymd: string; hour: number; events: CalendarEvent[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${ymd}@${hour}` });
  return (
    <div ref={setNodeRef} className={`min-h-14 border-b border-l p-1 ${isOver ? "bg-accent" : ""}`}>
      {events.map((event) => (
        <EventChip key={event.id} event={event} detailed />
      ))}
    </div>
  );
}

function EventChip({ event, detailed = false }: { event: CalendarEvent; detailed?: boolean }) {
  if (event.allDay) {
    return (
      <p className="truncate rounded-md bg-secondary px-1.5 py-0.5 text-xs">{event.title}</p>
    );
  }

  return <TimedEventChip event={event} detailed={detailed} />;
}

function TimedEventChip({ event, detailed }: { event: CalendarEvent; detailed: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `event:${event.id}`,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      className={`w-full truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-left text-xs text-primary ${isDragging ? "z-10 opacity-70" : ""}`}
      {...listeners}
      {...attributes}
    >
      {detailed ? `${formatTime(event.start)} ` : null}
      {event.title}
    </button>
  );
}
