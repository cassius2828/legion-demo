export function canViewPatient(input: {
  role: string;
  ownPatientId: string | null;
  ownProviderId: string | null;
  patient: { id: string; primaryProviderId: string };
}) {
  if (input.role === "patient") return input.patient.id === input.ownPatientId;
  if (input.role === "psychiatrist" || input.role === "nurse") {
    return (
      input.ownProviderId !== null &&
      input.patient.primaryProviderId === input.ownProviderId
    );
  }
  return false;
}

export function providerMayPrepareSummary(role: string) {
  return role === "psychiatrist" || role === "nurse";
}
