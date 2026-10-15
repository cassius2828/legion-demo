export type CalendarView = "month" | "week" | "day";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

const HOUR_START = 8;
const HOUR_END = 18;

export function formatYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateParam(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return formatYmd(new Date());
}

export function parseViewParam(value: string | undefined): CalendarView {
  if (value === "week" || value === "day") return value;
  return "month";
}

export function parseYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function visibleBounds(view: CalendarView, ymd: string) {
  const cursor = parseYmd(ymd);
  if (view === "day") {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    return { start, end: addDays(start, 1) };
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfWeek(startOfMonth(cursor));
  return { start, end: addDays(start, 42) };
}

export function shiftCursor(view: CalendarView, ymd: string, direction: -1 | 1) {
  const cursor = parseYmd(ymd);
  if (view === "day") return formatYmd(addDays(cursor, direction));
  if (view === "week") return formatYmd(addDays(cursor, direction * 7));
  return formatYmd(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
}

export function monthGrid(ymd: string) {
  const start = visibleBounds("month", ymd).start;
  return Array.from({ length: 42 }, (_, index) => formatYmd(addDays(start, index)));
}

export function weekDays(ymd: string) {
  const start = startOfWeek(parseYmd(ymd));
  return Array.from({ length: 7 }, (_, index) => formatYmd(addDays(start, index)));
}

export function hourSlots() {
  return Array.from({ length: HOUR_END - HOUR_START }, (_, index) => HOUR_START + index);
}

export function keepTimeOnDay(original: Date, ymd: string) {
  const day = parseYmd(ymd);
  const next = new Date(original);
  next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return next;
}

export function atHour(ymd: string, hour: number) {
  const day = parseYmd(ymd);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
}

export function eventsOnDay(events: CalendarEvent[], ymd: string) {
  const start = parseYmd(ymd).getTime();
  const end = addDays(parseYmd(ymd), 1).getTime();
  return events.filter((event) => {
    const time = new Date(event.start).getTime();
    return time >= start && time < end;
  });
}

export function hourOf(event: CalendarEvent) {
  const hour = new Date(event.start).getHours();
  if (hour < HOUR_START || hour >= HOUR_END) return null;
  return hour;
}

export function formatHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(date);
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayHeading(ymd: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseYmd(ymd));
}

export function formatRangeHeading(view: CalendarView, ymd: string) {
  const cursor = parseYmd(ymd);
  if (view === "day") {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(cursor);
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const startLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(end);
    return `${startLabel} – ${endLabel}`;
  }
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(cursor);
}
