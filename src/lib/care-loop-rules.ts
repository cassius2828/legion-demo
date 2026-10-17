export const FORMULARY = [
  {
    medicationName: "Sertraline",
    genericName: "sertraline",
    dosage: "50 mg",
    route: "oral",
    frequency: "every morning",
  },
  {
    medicationName: "Escitalopram",
    genericName: "escitalopram",
    dosage: "10 mg",
    route: "oral",
    frequency: "every morning",
  },
  {
    medicationName: "Bupropion XL",
    genericName: "bupropion",
    dosage: "150 mg",
    route: "oral",
    frequency: "every morning",
  },
  {
    medicationName: "Trazodone",
    genericName: "trazodone",
    dosage: "50 mg",
    route: "oral",
    frequency: "at bedtime",
  },
  {
    medicationName: "Propranolol",
    genericName: "propranolol",
    dosage: "10 mg",
    route: "oral",
    frequency: "about an hour before an event",
  },
  {
    medicationName: "Hydroxyzine",
    genericName: "hydroxyzine",
    dosage: "25 mg",
    route: "oral",
    frequency: "at bedtime as needed",
  },
  {
    medicationName: "Lamotrigine",
    genericName: "lamotrigine",
    dosage: "25 mg",
    route: "oral",
    frequency: "every evening",
  },
  {
    medicationName: "Quetiapine",
    genericName: "quetiapine",
    dosage: "50 mg",
    route: "oral",
    frequency: "at bedtime",
  },
  {
    medicationName: "Aripiprazole",
    genericName: "aripiprazole",
    dosage: "5 mg",
    route: "oral",
    frequency: "every morning",
  },
  {
    medicationName: "Prazosin",
    genericName: "prazosin",
    dosage: "1 mg",
    route: "oral",
    frequency: "at bedtime",
  },
  {
    medicationName: "Atomoxetine",
    genericName: "atomoxetine",
    dosage: "40 mg",
    route: "oral",
    frequency: "every morning",
  },
  {
    medicationName: "Lorazepam",
    genericName: "lorazepam",
    dosage: "0.5 mg",
    route: "oral",
    frequency: "as needed",
  },
] as const;

export type DrugChoice = {
  medicationName: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  source: "active" | "formulary";
};

export function drugChoices(
  active: {
    medicationName: string;
    genericName: string;
    dosage: string;
    route: string;
    frequency: string;
  }[],
): DrugChoice[] {
  const choices: DrugChoice[] = [];
  const seen = new Set<string>();
  for (const medication of active) {
    const key = medication.genericName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push({ ...medication, source: "active" });
  }
  for (const medication of FORMULARY) {
    const key = medication.genericName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push({ ...medication, source: "formulary" });
  }
  return choices;
}

export function pharmacyLabel(pharmacy: {
  name: string;
  street: string;
  city: string;
  state: string;
}) {
  return `${pharmacy.name}, ${pharmacy.street}, ${pharmacy.city}, ${pharmacy.state}`;
}

export function matchingAllergy(
  medicationName: string,
  genericName: string,
  allergies: string[],
) {
  const brand = medicationName.toLowerCase();
  const generic = genericName.toLowerCase();
  for (const allergy of allergies) {
    const needle = allergy.trim().toLowerCase();
    if (needle.length < 3) continue;
    if (brand.includes(needle) || generic.includes(needle)) return allergy;
  }
  return null;
}

export type TransmissionDecision = {
  status: "accepted" | "rejected";
  detail: string;
  override: boolean;
  substance: string | null;
};

export function transmissionDecision(input: {
  medicationName: string;
  genericName: string;
  allergies: string[];
  overrideReason: string | null;
}): TransmissionDecision {
  const substance = matchingAllergy(
    input.medicationName,
    input.genericName,
    input.allergies,
  );
  const override = Boolean(input.overrideReason?.trim());
  if (substance && !override) {
    return {
      status: "rejected",
      detail: `Allergy to ${substance}.`,
      override: false,
      substance,
    };
  }
  if (substance) {
    return {
      status: "accepted",
      detail: `Accepted with an allergy override for ${substance}.`,
      override: true,
      substance,
    };
  }
  return {
    status: "accepted",
    detail: "Accepted by the pharmacy.",
    override: false,
    substance: null,
  };
}

export type MedicationProjection = "active" | "discontinued" | "unchanged";

export function projectMedication(input: {
  action: string;
  accepted: boolean;
}): MedicationProjection {
  if (!input.accepted) return "unchanged";
  if (input.action === "discontinue") return "discontinued";
  return "active";
}

export type FollowUpBlock = "upcoming" | "same-day" | "taken" | null;

export function followUpResult(block: FollowUpBlock): "appointment" | "task" {
  if (block) return "task";
  return "appointment";
}

export function orderEventLabel(type: string) {
  switch (type) {
    case "order.queued":
      return "Queued";
    case "order.sent":
      return "Sent";
    case "order.accepted":
      return "Accepted";
    case "order.rejected":
      return "Rejected";
    case "order.allergy_override":
      return "Allergy override";
    default:
      return type;
  }
}

export function prescriptionMessage(input: {
  medicationName: string;
  pharmacyLabel: string;
  status: "accepted" | "rejected";
  detail: string;
}) {
  if (input.status === "accepted") {
    return `Your prescription for ${input.medicationName} was sent to ${input.pharmacyLabel}.`;
  }
  return `Your prescription for ${input.medicationName} was not sent. ${input.detail}`;
}
