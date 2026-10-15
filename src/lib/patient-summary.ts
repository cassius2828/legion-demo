import { z } from "zod";

export const patientSummarySchema = z.object({
  patientId: z.string(),
  overview: z.string(),
  diagnoses: z.array(z.string()),
  currentMedications: z.array(z.string()),
  discontinuedMedications: z.array(z.string()),
  recentVisitSummary: z.string(),
  outstandingTasks: z.array(z.string()),
});

export type PatientSummary = z.infer<typeof patientSummarySchema>;

export type SavedPatientSummary = {
  approvedLabel: string;
  outdated: boolean;
  summary: PatientSummary;
};
