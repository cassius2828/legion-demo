-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT,
    "primaryInsurance" TEXT,
    "secondaryInsurance" TEXT,
    "organizationId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "psychiatricHistory" TEXT NOT NULL,
    "primaryProviderId" TEXT NOT NULL,
    "preferredPharmacyId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientAllergy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "substance" TEXT NOT NULL,

    CONSTRAINT "PatientAllergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCondition" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "PatientCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fromProviderId" TEXT NOT NULL,
    "toProviderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "prescribingProviderId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderScheduleBlock" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "slotMinutes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "ProviderScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "nurseId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "appointmentType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reasonForVisit" TEXT NOT NULL,
    "cancellationReason" TEXT,
    "joinToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicMessage" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "clinicalSummary" TEXT NOT NULL,
    "followUpInstructions" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientSummaryRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "approvedByProviderId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "overview" TEXT NOT NULL,
    "recentVisitSummary" TEXT NOT NULL,
    "diagnoses" TEXT NOT NULL,
    "currentMedications" TEXT NOT NULL,
    "discontinuedMedications" TEXT NOT NULL,
    "outstandingTasks" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "PatientSummaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "assignedProviderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ncpdpId" TEXT NOT NULL,

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intake" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "phq9Score" INTEGER NOT NULL,
    "gad7Score" INTEGER NOT NULL,
    "safetyConcern" BOOLEAN NOT NULL,
    "safetyNote" TEXT,
    "medicationChangesNote" TEXT,
    "pharmacyId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionOrder" (
    "id" TEXT NOT NULL,
    "visitId" TEXT,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "prescribingProviderId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refills" INTEGER NOT NULL,
    "sig" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusDetail" TEXT NOT NULL,
    "allergyOverrideReason" TEXT,
    "medicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "visitId" TEXT,
    "appointmentId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_name_idx" ON "Post"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_email_key" ON "Provider"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_userId_key" ON "Provider"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_email_key" ON "Patient"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE INDEX "Patient_primaryProviderId_idx" ON "Patient"("primaryProviderId");

-- CreateIndex
CREATE INDEX "Patient_preferredPharmacyId_idx" ON "Patient"("preferredPharmacyId");

-- CreateIndex
CREATE INDEX "PatientAllergy_patientId_idx" ON "PatientAllergy"("patientId");

-- CreateIndex
CREATE INDEX "PatientCondition_patientId_idx" ON "PatientCondition"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_patientId_key" ON "EmergencyContact"("patientId");

-- CreateIndex
CREATE INDEX "ShareRequest_patientId_idx" ON "ShareRequest"("patientId");

-- CreateIndex
CREATE INDEX "ShareRequest_fromProviderId_idx" ON "ShareRequest"("fromProviderId");

-- CreateIndex
CREATE INDEX "ShareRequest_toProviderId_idx" ON "ShareRequest"("toProviderId");

-- CreateIndex
CREATE INDEX "Medication_patientId_idx" ON "Medication"("patientId");

-- CreateIndex
CREATE INDEX "ProviderScheduleBlock_providerId_idx" ON "ProviderScheduleBlock"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_joinToken_key" ON "Appointment"("joinToken");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_providerId_idx" ON "Appointment"("providerId");

-- CreateIndex
CREATE INDEX "Appointment_nurseId_idx" ON "Appointment"("nurseId");

-- CreateIndex
CREATE INDEX "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");

-- CreateIndex
CREATE INDEX "ClinicMessage_patientId_createdAt_idx" ON "ClinicMessage"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_appointmentId_key" ON "Visit"("appointmentId");

-- CreateIndex
CREATE INDEX "Visit_patientId_idx" ON "Visit"("patientId");

-- CreateIndex
CREATE INDEX "ClinicalNote_visitId_idx" ON "ClinicalNote"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSummaryRecord_patientId_key" ON "PatientSummaryRecord"("patientId");

-- CreateIndex
CREATE INDEX "Task_patientId_idx" ON "Task"("patientId");

-- CreateIndex
CREATE INDEX "Task_assignedProviderId_idx" ON "Task"("assignedProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_ncpdpId_key" ON "Pharmacy"("ncpdpId");

-- CreateIndex
CREATE UNIQUE INDEX "Intake_appointmentId_key" ON "Intake"("appointmentId");

-- CreateIndex
CREATE INDEX "Intake_patientId_idx" ON "Intake"("patientId");

-- CreateIndex
CREATE INDEX "Intake_pharmacyId_idx" ON "Intake"("pharmacyId");

-- CreateIndex
CREATE INDEX "PrescriptionOrder_patientId_idx" ON "PrescriptionOrder"("patientId");

-- CreateIndex
CREATE INDEX "PrescriptionOrder_visitId_idx" ON "PrescriptionOrder"("visitId");

-- CreateIndex
CREATE INDEX "PrescriptionOrder_appointmentId_idx" ON "PrescriptionOrder"("appointmentId");

-- CreateIndex
CREATE INDEX "PrescriptionOrder_pharmacyId_idx" ON "PrescriptionOrder"("pharmacyId");

-- CreateIndex
CREATE INDEX "ClinicalEvent_patientId_createdAt_idx" ON "ClinicalEvent"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalEvent_appointmentId_idx" ON "ClinicalEvent"("appointmentId");

-- CreateIndex
CREATE INDEX "ClinicalEvent_orderId_idx" ON "ClinicalEvent"("orderId");

-- CreateIndex
CREATE INDEX "Reminder_patientId_idx" ON "Reminder"("patientId");

-- CreateIndex
CREATE INDEX "Reminder_appointmentId_idx" ON "Reminder"("appointmentId");

-- CreateIndex
CREATE INDEX "Reminder_status_dueAt_idx" ON "Reminder"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_primaryProviderId_fkey" FOREIGN KEY ("primaryProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_preferredPharmacyId_fkey" FOREIGN KEY ("preferredPharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAllergy" ADD CONSTRAINT "PatientAllergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCondition" ADD CONSTRAINT "PatientCondition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareRequest" ADD CONSTRAINT "ShareRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareRequest" ADD CONSTRAINT "ShareRequest_fromProviderId_fkey" FOREIGN KEY ("fromProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareRequest" ADD CONSTRAINT "ShareRequest_toProviderId_fkey" FOREIGN KEY ("toProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_prescribingProviderId_fkey" FOREIGN KEY ("prescribingProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderScheduleBlock" ADD CONSTRAINT "ProviderScheduleBlock_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMessage" ADD CONSTRAINT "ClinicMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMessage" ADD CONSTRAINT "ClinicMessage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMessage" ADD CONSTRAINT "ClinicMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSummaryRecord" ADD CONSTRAINT "PatientSummaryRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSummaryRecord" ADD CONSTRAINT "PatientSummaryRecord_approvedByProviderId_fkey" FOREIGN KEY ("approvedByProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedProviderId_fkey" FOREIGN KEY ("assignedProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionOrder" ADD CONSTRAINT "PrescriptionOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionOrder" ADD CONSTRAINT "PrescriptionOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionOrder" ADD CONSTRAINT "PrescriptionOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionOrder" ADD CONSTRAINT "PrescriptionOrder_prescribingProviderId_fkey" FOREIGN KEY ("prescribingProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionOrder" ADD CONSTRAINT "PrescriptionOrder_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvent" ADD CONSTRAINT "ClinicalEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvent" ADD CONSTRAINT "ClinicalEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvent" ADD CONSTRAINT "ClinicalEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvent" ADD CONSTRAINT "ClinicalEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvent" ADD CONSTRAINT "ClinicalEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PrescriptionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
