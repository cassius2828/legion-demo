export const ROLES = [
  { id: "psychiatrist", label: "Psychiatrist" },
  { id: "patient", label: "Patient" },
  { id: "nurse", label: "Nurse" },
] as const;

export const ORGANIZATIONS = [
  "Kaiser Permanente",
  "Sutter Health",
  "Cleveland Clinic",
  "Mayo Clinic",
  "HCA Healthcare",
  "LifeStance Health",
] as const;

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
] as const;

export type Role = (typeof ROLES)[number]["id"];

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role.id === value);
}

export function isInsurance(value: string): value is (typeof INSURANCES)[number] {
  return (INSURANCES as readonly string[]).includes(value);
}

export function roleLabel(role: string) {
  return ROLES.find((item) => item.id === role)?.label ?? role;
}
