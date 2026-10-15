export const CLINIC_TIME_ZONE = "America/Los_Angeles";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

export function zonedParts(date: Date, timeZone = CLINIC_TIME_ZONE): ZonedParts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const bag = Object.fromEntries(
    formatted.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  const hour = Number(bag.hour);
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(bag.minute),
    weekday: WEEKDAYS.indexOf((bag.weekday ?? "") as (typeof WEEKDAYS)[number]),
  };
}

export function weekdayOf(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addCalendarDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
  timeZone = CLINIC_TIME_ZONE,
) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const delta = desired - asUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}
