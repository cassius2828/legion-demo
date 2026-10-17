"use server";

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { completeIntake } from "~/server/care-loop";

export async function saveIntake(
  _previous: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "patient") {
    return { error: "Sign in as a patient to complete intake." };
  }

  const appointmentId = formData.get("appointmentId");
  const pharmacyId = formData.get("pharmacyId");
  const phq9 = Number(formData.get("phq9"));
  const gad7 = Number(formData.get("gad7"));
  const safetyConcern = formData.get("safetyConcern") === "on";
  const safetyNote = formData.get("safetyNote");
  const medicationChangesNote = formData.get("medicationChanges");

  const result = await completeIntake({
    userId: session.user.id,
    appointmentId: typeof appointmentId === "string" ? appointmentId : "",
    pharmacyId: typeof pharmacyId === "string" ? pharmacyId : "",
    phq9Score: phq9,
    gad7Score: gad7,
    safetyConcern,
    safetyNote: typeof safetyNote === "string" ? safetyNote : "",
    medicationChangesNote:
      typeof medicationChangesNote === "string" ? medicationChangesNote : "",
  });
  if (!result.ok) return { error: result.error };
  redirect("/");
}
