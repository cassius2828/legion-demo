import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

function names(rows) {
  return rows.map((row) => row.medicationName.toLowerCase());
}

function includesAll(values, expected) {
  return expected.every((name) => values.some((value) => value.includes(name)));
}

const medications = await db.medication.findMany({
  where: { patientId: "pat_16" },
  select: { medicationName: true, dosage: true, status: true },
});
const active = names(medications.filter((row) => row.status === "active"));
const discontinued = names(medications.filter((row) => row.status === "discontinued"));
const other = medications.filter((row) => row.status !== "active" && row.status !== "discontinued");

const tasks = await db.task.findMany({
  where: { patientId: "pat_16" },
  select: { title: true, status: true },
});
const openTitles = tasks.filter((row) => row.status === "open").map((row) => row.title);
const doneTitles = tasks.filter((row) => row.status === "done").map((row) => row.title);

const failures = [];
if (!includesAll(active, ["escitalopram", "propranolol", "trazodone"])) {
  failures.push(`active medications were ${active.join(", ") || "empty"}`);
}
if (!includesAll(discontinued, ["hydroxyzine", "zolpidem"])) {
  failures.push(`discontinued medications were ${discontinued.join(", ") || "empty"}`);
}
if (active.some((name) => name.includes("hydroxyzine") || name.includes("zolpidem"))) {
  failures.push("a stopped medication was left in the active list");
}
if (discontinued.some((name) => name.includes("escitalopram"))) {
  failures.push("escitalopram was marked discontinued");
}
if (other.length > 0) {
  failures.push("a medication had a status other than active or discontinued");
}
if (!openTitles.includes("Confirm the October evaluation time")) {
  failures.push("the open evaluation task was missing");
}
if (openTitles.includes("Send intake paperwork")) {
  failures.push("the completed intake task was returned as open");
}
if (!doneTitles.includes("Send intake paperwork")) {
  failures.push("the completed intake task was missing");
}

await db.$disconnect();

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Derrick Rose medication and task lists match the chart.");
