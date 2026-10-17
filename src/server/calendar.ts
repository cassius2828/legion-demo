import "server-only";

import { CLINIC_TIME_ZONE } from "~/lib/clinic-time";
import type { CalendarEvent } from "~/lib/calendar-dates";
import { getGoogleAccessToken } from "~/server/auth/google-account";

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

async function calendarFetch(userId: string, url: string, init?: RequestInit) {
  const first = await getGoogleAccessToken(userId);
  if ("error" in first) return { error: "connect" as const };

  const send = (token: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

  try {
    let response = await send(first.token);
    if (response.status === 401) {
      const second = await getGoogleAccessToken(userId, { force: true });
      if ("error" in second) return { error: "connect" as const };
      response = await send(second.token);
    }
    return { response };
  } catch {
    return { response: new Response(null, { status: 503 }) };
  }
}

function eventTitle(summary: string | undefined) {
  const title = summary?.trim() ?? "";
  if (title.length === 0) return "(No title)";
  return title;
}

function toCalendarEvent(item: GoogleEvent): CalendarEvent | null {
  if (!item.id || item.status === "cancelled") return null;
  if (item.start?.dateTime && item.end?.dateTime) {
    return {
      id: item.id,
      title: eventTitle(item.summary),
      start: item.start.dateTime,
      end: item.end.dateTime,
      allDay: false,
    };
  }
  if (item.start?.date) {
    const start = new Date(`${item.start.date}T00:00:00`);
    const end = item.end?.date
      ? new Date(`${item.end.date}T00:00:00`)
      : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return {
      id: item.id,
      title: eventTitle(item.summary),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: true,
    };
  }
  return null;
}

export async function listCalendarEvents(userId: string, range: { start: Date; end: Date }) {
  const params = new URLSearchParams({
    timeMin: range.start.toISOString(),
    timeMax: range.end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const result = await calendarFetch(
    userId,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
  );
  if ("error" in result) return { connected: false as const };
  if (!result.response.ok) {
    return { connected: true as const, events: [] as CalendarEvent[], error: "Could not load Google Calendar." };
  }
  const json = (await result.response.json()) as { items?: GoogleEvent[] };
  const events = (json.items ?? [])
    .map(toCalendarEvent)
    .filter((event): event is CalendarEvent => event !== null);
  return { connected: true as const, events };
}

export async function createCalendarEvent(
  userId: string,
  input: { title: string; start: Date; end: Date },
) {
  const result = await calendarFetch(
    userId,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.title,
        start: { dateTime: input.start.toISOString(), timeZone: CLINIC_TIME_ZONE },
        end: { dateTime: input.end.toISOString(), timeZone: CLINIC_TIME_ZONE },
      }),
    },
  );
  if ("error" in result) return { ok: false as const, error: "connect" };
  if (!result.response.ok) {
    return { ok: false as const, error: "Google Calendar could not save that appointment." };
  }
  return { ok: true as const };
}

export async function moveCalendarEvent(
  userId: string,
  input: { id: string; start: Date; end: Date },
) {
  const result = await calendarFetch(
    userId,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        start: { dateTime: input.start.toISOString(), timeZone: CLINIC_TIME_ZONE },
        end: { dateTime: input.end.toISOString(), timeZone: CLINIC_TIME_ZONE },
      }),
    },
  );
  if ("error" in result) return { ok: false as const, error: "connect" };
  if (!result.response.ok) {
    return { ok: false as const, error: "Google Calendar could not move that appointment." };
  }
  return { ok: true as const };
}
