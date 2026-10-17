"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { deliverDueReminders } from "~/server/reminders";

export async function sendDueReminders() {
  const session = await auth();
  if (!session?.user?.role || session.user.role === "patient") {
    return {
      ok: false as const,
      error: "Sign in as a provider to send reminders.",
    };
  }
  const provider = await db.provider.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!provider)
    return {
      ok: false as const,
      error: "No provider chart is linked to this account.",
    };

  const sent = await deliverDueReminders(provider.id);
  revalidatePath("/");
  revalidatePath("/messages");
  return { ok: true as const, sent };
}
