import { fullName, providerLabel } from "~/lib/chart";
import { roleLabel } from "~/lib/profile";

export type DirectoryKind = "psychiatrist" | "nurse" | "patient";

export type AdminField = {
  label: string;
  value: string;
};

export type AdminAccount = {
  name: string;
  fields: AdminField[];
  history: null;
};

export type AdminChart<TVisit, TMedication> = {
  name: string;
  fields: AdminField[];
  history: { visits: TVisit[]; medications: TMedication[] };
};

const KINDS = new Set<DirectoryKind>(["psychiatrist", "nurse", "patient"]);

export function isDirectoryKind(value: string): value is DirectoryKind {
  return KINDS.has(value as DirectoryKind);
}

export function personProfilePath(kind: DirectoryKind, id: string) {
  return `/dev-admin/people/${kind}/${id}`;
}

function clinicianKind(role: string | null | undefined, credentials: string) {
  if (role === "nurse" || credentials === "PMHNP") return "nurse" as const;
  return "psychiatrist" as const;
}

function insuranceLabel(
  primary: string | null | undefined,
  secondary: string | null | undefined,
) {
  const parts = [primary, secondary].filter((value): value is string =>
    Boolean(value),
  );
  return parts.length > 0 ? parts.join(" · ") : "No insurance recorded";
}

export function patientChartProfile<TVisit, TMedication>(patient: {
  firstName: string;
  lastName: string;
  email: string;
  user: {
    email: string | null;
    primaryInsurance: string | null;
    secondaryInsurance: string | null;
  } | null;
  primaryProvider: { firstName: string; lastName: string; credentials: string };
  visits: TVisit[];
  medications: TMedication[];
}): AdminChart<TVisit, TMedication> {
  return {
    name: fullName(patient),
    fields: [
      { label: "Email", value: patient.user?.email ?? patient.email },
      { label: "Role", value: roleLabel("patient") },
      {
        label: "Insurance",
        value: insuranceLabel(
          patient.user?.primaryInsurance,
          patient.user?.secondaryInsurance,
        ),
      },
      { label: "Clinician", value: providerLabel(patient.primaryProvider) },
    ],
    history: { visits: patient.visits, medications: patient.medications },
  };
}

export function unlinkedPatientProfile(
  user: {
    name: string | null;
    email: string | null;
    role: string | null;
    primaryInsurance: string | null;
    secondaryInsurance: string | null;
  } | null,
): AdminAccount | null {
  if (!user || user.role !== "patient") return null;
  return {
    name: user.name ?? "No name",
    fields: [
      { label: "Email", value: user.email ?? "No email" },
      { label: "Role", value: roleLabel("patient") },
      {
        label: "Insurance",
        value: insuranceLabel(user.primaryInsurance, user.secondaryInsurance),
      },
    ],
    history: null,
  };
}

export function providerProfile(
  provider: {
    firstName: string;
    lastName: string;
    email: string;
    credentials: string;
    specialty: string;
    organization: { name: string } | null;
    user: {
      email: string | null;
      role: string | null;
      organization: { name: string } | null;
    } | null;
  },
  kind: "psychiatrist" | "nurse",
): AdminAccount | null {
  if (clinicianKind(provider.user?.role, provider.credentials) !== kind) {
    return null;
  }
  return {
    name: fullName(provider),
    fields: [
      { label: "Email", value: provider.user?.email ?? provider.email },
      { label: "Role", value: roleLabel(kind) },
      {
        label: "Organization",
        value:
          provider.organization?.name ??
          provider.user?.organization?.name ??
          "No provider",
      },
      { label: "Credentials", value: provider.credentials },
      { label: "Specialty", value: provider.specialty },
    ],
    history: null,
  };
}

export function unlinkedClinicianProfile(
  user: {
    name: string | null;
    email: string | null;
    role: string | null;
    organization: { name: string } | null;
  } | null,
  kind: "psychiatrist" | "nurse",
): AdminAccount | null {
  if (!user || user.role !== kind) return null;
  return {
    name: user.name ?? "No name",
    fields: [
      { label: "Email", value: user.email ?? "No email" },
      { label: "Role", value: roleLabel(kind) },
      {
        label: "Organization",
        value: user.organization?.name ?? "No provider",
      },
    ],
    history: null,
  };
}
