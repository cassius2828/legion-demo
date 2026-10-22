import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDevAdmin } from "./admin.ts";
import {
  isDirectoryKind,
  patientChartProfile,
  personProfilePath,
  providerProfile,
  unlinkedClinicianProfile,
  unlinkedPatientProfile,
} from "./admin-profile.ts";

function field(
  profile: { fields: { label: string; value: string }[] },
  label: string,
) {
  return profile.fields.find((item) => item.label === label)?.value;
}

const visits = [{ id: "visit_1" }];
const medications = [{ id: "med_1" }];

describe("person profile links", () => {
  it("builds a path from the card kind and id", () => {
    assert.equal(
      personProfilePath("patient", "pat_16"),
      "/dev-admin/people/patient/pat_16",
    );
    assert.equal(
      personProfilePath("psychiatrist", "prv_04"),
      "/dev-admin/people/psychiatrist/prv_04",
    );
    assert.equal(
      personProfilePath("nurse", "user_left"),
      "/dev-admin/people/nurse/user_left",
    );
  });

  it("accepts only patient, psychiatrist, and nurse", () => {
    assert.equal(isDirectoryKind("patient"), true);
    assert.equal(isDirectoryKind("psychiatrist"), true);
    assert.equal(isDirectoryKind("nurse"), true);
    assert.equal(isDirectoryKind("admin"), false);
    assert.equal(isDirectoryKind(""), false);
  });
});

describe("admin profile access", () => {
  it("allows only the dev admin", () => {
    assert.equal(isDevAdmin("cassius2828@gmail.com"), true);
    assert.equal(isDevAdmin("Cassius2828@gmail.com"), true);
    assert.equal(isDevAdmin("ruth.abebe@example.com"), false);
    assert.equal(isDevAdmin(null), false);
  });
});

describe("patient profile", () => {
  it("shows the chart account and keeps visits and medications", () => {
    const profile = patientChartProfile({
      firstName: "Ruth",
      lastName: "Abebe",
      email: "chart@example.com",
      user: {
        email: "ruth.abebe@example.com",
        primaryInsurance: "Cigna",
        secondaryInsurance: "Medicare",
      },
      primaryProvider: {
        firstName: "Muhammad",
        lastName: "Ali",
        credentials: "MD",
      },
      visits,
      medications,
    });

    assert.equal(profile.name, "Ruth Abebe");
    assert.equal(field(profile, "Email"), "ruth.abebe@example.com");
    assert.equal(field(profile, "Role"), "Patient");
    assert.equal(field(profile, "Insurance"), "Cigna · Medicare");
    assert.equal(field(profile, "Clinician"), "Muhammad Ali, MD");
    assert.equal(profile.history?.visits, visits);
    assert.equal(profile.history?.medications, medications);
  });

  it("uses the chart email and an empty insurance line when the account has neither", () => {
    const profile = patientChartProfile({
      firstName: "Nora",
      lastName: "Keita",
      email: "nora.keita@example.com",
      user: {
        email: null,
        primaryInsurance: null,
        secondaryInsurance: null,
      },
      primaryProvider: {
        firstName: "Elena",
        lastName: "Vasquez",
        credentials: "MD",
      },
      visits: [],
      medications: [],
    });

    assert.equal(field(profile, "Email"), "nora.keita@example.com");
    assert.equal(field(profile, "Insurance"), "No insurance recorded");
  });

  it("shows only the account fields for a user with no chart", () => {
    const profile = unlinkedPatientProfile({
      name: null,
      email: null,
      role: "patient",
      primaryInsurance: "Aetna",
      secondaryInsurance: null,
    });

    assert.ok(profile);
    assert.equal(profile.name, "No name");
    assert.equal(field(profile, "Email"), "No email");
    assert.equal(field(profile, "Role"), "Patient");
    assert.equal(field(profile, "Insurance"), "Aetna");
    assert.equal(profile.history, null);
    assert.equal(
      profile.fields.some((item) => item.label === "Clinician"),
      false,
    );
  });

  it("returns nothing when the leftover user is not a patient", () => {
    assert.equal(
      unlinkedPatientProfile({
        name: "Elena Vasquez",
        email: "elena.vasquez@example.com",
        role: "psychiatrist",
        primaryInsurance: null,
        secondaryInsurance: null,
      }),
      null,
    );
    assert.equal(unlinkedPatientProfile(null), null);
  });
});

describe("clinician profile", () => {
  it("shows organization, credentials, and specialty for a psychiatrist", () => {
    const profile = providerProfile(
      {
        firstName: "Elena",
        lastName: "Vasquez",
        email: "chart@example.com",
        credentials: "MD",
        specialty: "Psychiatry",
        organization: { name: "Sutter Health" },
        user: {
          email: "elena.vasquez@example.com",
          role: "psychiatrist",
          organization: { name: "Kaiser Permanente" },
        },
      },
      "psychiatrist",
    );

    assert.ok(profile);
    assert.equal(profile.name, "Elena Vasquez");
    assert.equal(field(profile, "Email"), "elena.vasquez@example.com");
    assert.equal(field(profile, "Role"), "Psychiatrist");
    assert.equal(field(profile, "Organization"), "Sutter Health");
    assert.equal(field(profile, "Credentials"), "MD");
    assert.equal(field(profile, "Specialty"), "Psychiatry");
    assert.equal(profile.history, null);
  });

  it("treats a PMHNP as a nurse and refuses the psychiatrist path", () => {
    const provider = {
      firstName: "Jordan",
      lastName: "Hale",
      email: "jordan.hale@example.com",
      credentials: "PMHNP",
      specialty: "Psychiatric mental health",
      organization: null,
      user: {
        email: null,
        role: "psychiatrist",
        organization: { name: "Kaiser Permanente" },
      },
    };

    assert.equal(providerProfile(provider, "psychiatrist"), null);
    const profile = providerProfile(provider, "nurse");
    assert.ok(profile);
    assert.equal(field(profile, "Email"), "jordan.hale@example.com");
    assert.equal(field(profile, "Role"), "Nurse");
    assert.equal(field(profile, "Organization"), "Kaiser Permanente");
  });

  it("uses the chart email and an empty organization when neither record has one", () => {
    const profile = providerProfile(
      {
        firstName: "Samuel",
        lastName: "Adeyemi",
        email: "samuel.adeyemi@example.com",
        credentials: "MD",
        specialty: "Psychiatry",
        organization: null,
        user: null,
      },
      "psychiatrist",
    );

    assert.ok(profile);
    assert.equal(field(profile, "Email"), "samuel.adeyemi@example.com");
    assert.equal(field(profile, "Organization"), "No provider");
  });

  it("shows the account fields that exist for an unlinked clinician", () => {
    const profile = unlinkedClinicianProfile(
      {
        name: null,
        email: "new.nurse@example.com",
        role: "nurse",
        organization: null,
      },
      "nurse",
    );

    assert.ok(profile);
    assert.equal(profile.name, "No name");
    assert.equal(field(profile, "Email"), "new.nurse@example.com");
    assert.equal(field(profile, "Role"), "Nurse");
    assert.equal(field(profile, "Organization"), "No provider");
    assert.equal(
      profile.fields.some((item) => item.label === "Credentials"),
      false,
    );
    assert.equal(profile.history, null);
  });

  it("returns nothing when the leftover user role does not match the path", () => {
    const user = {
      name: "Elena Vasquez",
      email: "elena.vasquez@example.com",
      role: "psychiatrist",
      organization: { name: "Sutter Health" },
    };
    assert.equal(unlinkedClinicianProfile(user, "nurse"), null);
    assert.equal(unlinkedClinicianProfile(null, "psychiatrist"), null);
  });
});
