export const UPCOMING_APPOINTMENT_ERROR =
  "This patient already has an upcoming appointment.";
export const SAME_DAY_APPOINTMENT_ERROR =
  "That day already has an appointment. Pick another day.";

const CLINIC_TIME_ZONE = "America/Los_Angeles";

export type UsualVisit = {
  weekday: string;
  time: string;
  count: number;
};

export type OpenSlotChoice = {
  start: Date;
  weekday: string;
  time: string;
};

function clinicDayKey(date: Date) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const bag = Object.fromEntries(
    formatted
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${bag.year}-${bag.month}-${bag.day}`;
}

export function minutesFromTimeLabel(label: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]!.toUpperCase();
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  return hour * 60 + minute;
}

export function usualWeekdayAndTime(
  visits: { weekday: string; time: string; status: string }[],
): UsualVisit | null {
  const counts = new Map<string, UsualVisit>();
  for (const visit of visits) {
    if (visit.status !== "completed") continue;
    const key = `${visit.weekday} ${visit.time}`;
    const current = counts.get(key) ?? {
      weekday: visit.weekday,
      time: visit.time,
      count: 0,
    };
    current.count += 1;
    counts.set(key, current);
  }
  return (
    [...counts.values()].sort((left, right) => right.count - left.count)[0] ??
    null
  );
}

export function bookingRefusal(
  visits: { scheduledAt: Date }[],
  start: Date,
  moving: boolean,
  now = new Date(),
) {
  if (
    !moving &&
    visits.some((visit) => visit.scheduledAt.getTime() >= now.getTime())
  ) {
    return "upcoming" as const;
  }
  const day = clinicDayKey(start);
  if (visits.some((visit) => clinicDayKey(visit.scheduledAt) === day)) {
    return "same-day" as const;
  }
  return null;
}

export function expectedOpenStart(input: {
  slots: OpenSlotChoice[];
  usual: { weekday: string; time: string } | null;
  excludeStart?: Date | null;
  otherScheduled?: { scheduledAt: Date }[];
}) {
  const exclude = input.excludeStart?.getTime() ?? null;
  const others = input.otherScheduled ?? [];
  const open = input.slots
    .filter((slot) => exclude === null || slot.start.getTime() !== exclude)
    .filter((slot) => bookingRefusal(others, slot.start, true) !== "same-day")
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  if (open.length === 0) return null;

  const usual = input.usual;
  if (usual) {
    const exact = open.filter(
      (slot) => slot.weekday === usual.weekday && slot.time === usual.time,
    );
    const exactStart = exact[0];
    if (exactStart) return exactStart.start;

    const sameWeekday = open.filter((slot) => slot.weekday === usual.weekday);
    const usualMinutes = minutesFromTimeLabel(usual.time);
    if (sameWeekday.length > 0 && usualMinutes !== null) {
      const nearest = [...sameWeekday].sort((left, right) => {
        const leftGap = Math.abs(
          (minutesFromTimeLabel(left.time) ?? usualMinutes) - usualMinutes,
        );
        const rightGap = Math.abs(
          (minutesFromTimeLabel(right.time) ?? usualMinutes) - usualMinutes,
        );
        if (leftGap !== rightGap) return leftGap - rightGap;
        return left.start.getTime() - right.start.getTime();
      });
      return nearest[0]?.start ?? null;
    }
    const firstWeekday = sameWeekday[0];
    if (firstWeekday) return firstWeekday.start;
  }

  return open[0]?.start ?? null;
}
