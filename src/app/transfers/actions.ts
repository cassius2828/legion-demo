"use server";

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function currentProvider() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");
  const provider = await db.provider.findUnique({ where: { userId: session.user.id } });
  if (!provider) redirect("/");
  return provider;
}

export async function requestShare(formData: FormData) {
  const provider = await currentProvider();
  const patientId = readText(formData, "patientId");
  const toProviderId = readText(formData, "toProviderId");
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (patient?.primaryProviderId !== provider.id || toProviderId === provider.id) {
    redirect("/");
  }
  const destination = await db.provider.findUnique({ where: { id: toProviderId } });
  if (!destination) redirect("/");

  const existing = await db.shareRequest.findFirst({
    where: {
      patientId,
      fromProviderId: provider.id,
      toProviderId,
      status: "pending",
    },
  });
  if (!existing) {
    await db.shareRequest.create({
      data: {
        patientId,
        fromProviderId: provider.id,
        toProviderId,
        status: "pending",
      },
    });
  }
  redirect("/transfers");
}

export async function acceptShare(formData: FormData) {
  const provider = await currentProvider();
  const requestId = readText(formData, "requestId");
  const request = await db.shareRequest.findUnique({ where: { id: requestId } });
  if (request?.status !== "pending" || request?.toProviderId !== provider.id) {
    redirect("/transfers");
  }

  await db.$transaction([
    db.patient.update({
      where: { id: request.patientId },
      data: { primaryProviderId: provider.id },
    }),
    db.shareRequest.update({
      where: { id: request.id },
      data: { status: "accepted" },
    }),
  ]);
  redirect("/transfers");
}
