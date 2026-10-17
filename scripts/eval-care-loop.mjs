import {
  followUpResult,
  projectMedication,
  transmissionDecision,
} from "../src/lib/care-loop-rules.ts";

const failures = [];

const rejected = transmissionDecision({
  medicationName: "Sulfasalazine",
  genericName: "sulfasalazine",
  allergies: ["Sulfa"],
  overrideReason: null,
});
if (rejected.status !== "rejected" || rejected.override) {
  failures.push("an allergy match without an override was not rejected");
}

const overridden = transmissionDecision({
  medicationName: "Sulfasalazine",
  genericName: "sulfasalazine",
  allergies: ["Sulfa"],
  overrideReason: "Previously tolerated a short course.",
});
if (overridden.status !== "accepted" || !overridden.override) {
  failures.push("an allergy override did not accept the order");
}

const clear = transmissionDecision({
  medicationName: "Escitalopram",
  genericName: "escitalopram",
  allergies: ["Sulfa"],
  overrideReason: null,
});
if (clear.status !== "accepted" || clear.override) {
  failures.push("escitalopram was treated as a sulfa allergy");
}

const stopped = projectMedication({ action: "discontinue", accepted: true });
if (stopped !== "discontinued") {
  failures.push("an accepted discontinue did not stop the medication");
}
if (stopped === "active") {
  failures.push("an accepted discontinue left the medication active");
}

const refilled = projectMedication({ action: "refill", accepted: true });
if (refilled !== "active") {
  failures.push("an accepted refill did not keep the medication active");
}

const blockedSend = projectMedication({ action: "refill", accepted: false });
if (blockedSend !== "unchanged") {
  failures.push("a rejected order changed the medication list");
}

for (const block of ["upcoming", "same-day", "taken"]) {
  if (followUpResult(block) !== "task") {
    failures.push(`a ${block} follow-up was booked instead of becoming a task`);
  }
}
if (followUpResult(null) !== "appointment") {
  failures.push("an open follow-up did not book an appointment");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Care loop rules match allergy, medication, and follow-up decisions.");
