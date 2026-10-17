"use server";

import { closeVisit, signVisitNote, transmitOrder } from "~/server/care-loop";

export async function signNote(input: {
  appointmentId: string;
  summary: string;
  followUp: string;
}) {
  return signVisitNote(input);
}

export async function sendPrescription(input: {
  appointmentId: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  quantity: number;
  refills: number;
  action: "new" | "refill" | "change" | "discontinue";
  pharmacyConfirmed: boolean;
  overrideReason: string;
}) {
  return transmitOrder(input);
}

export async function finishVisit(appointmentId: string) {
  return closeVisit(appointmentId);
}
