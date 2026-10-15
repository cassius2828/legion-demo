import { env } from "~/env";
import { db } from "~/server/db";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_FULL_SCOPE = "https://www.googleapis.com/auth/calendar";

export function calendarIsLinked(account: {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
} | null) {
  if (!account?.access_token && !account?.refresh_token) return false;
  const scopes = (account.scope ?? "").split(/\s+/);
  return scopes.includes(CALENDAR_SCOPE) || scopes.includes(CALENDAR_FULL_SCOPE);
}

export async function saveGoogleOAuthTokens(input: {
  userId: string;
  providerAccountId: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
}) {
  const data: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    scope?: string;
    id_token?: string;
  } = {};
  if (input.access_token) data.access_token = input.access_token;
  if (input.refresh_token) data.refresh_token = input.refresh_token;
  if (typeof input.expires_at === "number") data.expires_at = input.expires_at;
  if (input.token_type) data.token_type = input.token_type;
  if (input.scope) data.scope = input.scope;
  if (input.id_token) data.id_token = input.id_token;
  if (Object.keys(data).length === 0) return;

  await db.account.updateMany({
    where: {
      userId: input.userId,
      provider: "google",
      providerAccountId: input.providerAccountId,
    },
    data,
  });
}

export async function getGoogleAccessToken(userId: string, options?: { force?: boolean }) {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account || !calendarIsLinked(account)) return { error: "connect" as const };

  const expiresAtMs = (account.expires_at ?? 0) * 1000;
  const stillValid = Boolean(account.access_token) && expiresAtMs > Date.now() + 60_000;
  if (account.access_token && stillValid && !options?.force) {
    return { token: account.access_token };
  }
  if (!account.refresh_token) return { error: "connect" as const };

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: account.refresh_token,
    grant_type: "refresh_token",
  });
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    return { error: "connect" as const };
  }
  if (!response.ok) return { error: "connect" as const };

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!json.access_token || !json.expires_in) return { error: "connect" as const };

  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: json.access_token,
      expires_at: Math.floor(Date.now() / 1000) + json.expires_in,
      scope: json.scope ?? account.scope,
    },
  });
  return { token: json.access_token };
}
