// Keep this list aligned with INSURANCES in src/lib/profile.ts.
export const INSURANCES = [
  "Kaiser Permanente",
  "Sutter Health Plus",
  "Blue Shield of California",
  "Anthem Blue Cross",
  "Aetna",
  "UnitedHealthcare",
  "Cigna",
  "Medicare",
  "Medi-Cal",
  "Health Net",
];

const UNINSURED = new Set([7, 19, 31, 43]);
const COMMERCIAL = INSURANCES.filter((name) => name !== "Medicare");

export function coverageFor(patientId, dateOfBirth) {
  const number = Number(String(patientId).replace(/\D/g, ""));
  if (patientId === "pat_16") {
    return {
      primaryInsurance: "Kaiser Permanente",
      secondaryInsurance: "Sutter Health Plus",
    };
  }
  if (UNINSURED.has(number)) {
    return { primaryInsurance: null, secondaryInsurance: null };
  }

  const born = new Date(dateOfBirth);
  const age = 2026 - born.getUTCFullYear();
  const pool = age >= 65 ? INSURANCES : COMMERCIAL;
  const primaryInsurance = pool[number % pool.length];
  if (number % 2 === 1) {
    return { primaryInsurance, secondaryInsurance: null };
  }

  let secondaryInsurance = age >= 65 ? "Medicare" : pool[(number + 3) % pool.length];
  if (secondaryInsurance === primaryInsurance) {
    secondaryInsurance = pool[(number + 1) % pool.length];
  }
  return { primaryInsurance, secondaryInsurance };
}
