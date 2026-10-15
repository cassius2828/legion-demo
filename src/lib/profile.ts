export const ROLES = [
  { id: "psychiatrist", label: "Psychiatrist" },
  { id: "patient", label: "Patient" },
  { id: "nurse", label: "Nurse" },
] as const;

export const ORGANIZATIONS = [
  "Kaiser Permanente",
  "Cleveland Clinic",
  "Mayo Clinic",
  "HCA Healthcare",
  "LifeStance Health",
] as const;

export type Role = (typeof ROLES)[number]["id"];

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role.id === value);
}

export function roleLabel(role: string) {
  return ROLES.find((item) => item.id === role)?.label ?? role;
}
