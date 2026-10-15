"use server";

import { redirect } from "next/navigation";

import { isRole, type Role } from "~/lib/profile";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

function isUniqueEmail(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function organizationName(formData: FormData) {
  const choice = readText(formData, "organizationChoice");
  if (choice === "other") return readText(formData, "organizationOther");
  return choice;
}

async function organizationIdFor(name: string) {
  const organization = await db.organization.upsert({
    where: { name },
    create: { name },
    update: {},
    select: { id: true },
  });
  return organization.id;
}

export async function saveSignup(_state: { error: string } | null, formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role) redirect("/");

  const roleValue = readText(formData, "role");
  if (!isRole(roleValue)) return { error: "Choose a role." };

  const saved = await saveProfileFields(session.user.id, roleValue, formData, "signup");
  if (saved) return saved;
  redirect("/");
}

export async function saveProfile(_state: { error: string } | null, formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role || !isRole(session.user.role)) redirect("/onboarding");

  const saved = await saveProfileFields(session.user.id, session.user.role, formData, "edit");
  if (saved) return saved;
  redirect("/profile");
}

async function findUserIdByEmail(email: string) {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function saveProfileFields(
  userId: string,
  role: Role,
  formData: FormData,
  mode: "signup" | "edit",
) {
  const name = readText(formData, "name");
  const email = readText(formData, "email");
  if (name.length === 0 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter your name and a valid email." };
  }

  const patient = role === "patient";
  const primaryInsurance = readText(formData, "primaryInsurance");
  const secondaryInsurance = readText(formData, "secondaryInsurance");
  const organization = organizationName(formData);

  if (patient && (primaryInsurance.length === 0 || primaryInsurance.length > 120)) {
    return { error: "Enter a primary insurance." };
  }
  if (!patient && (organization.length === 0 || organization.length > 120)) {
    return { error: "Choose a provider." };
  }
  if (secondaryInsurance.length > 120) {
    return { error: "Secondary insurance is too long." };
  }

  const organizationId = patient ? null : await organizationIdFor(organization);
  const data = {
    name,
    email,
    role,
    primaryInsurance: patient ? primaryInsurance : null,
    secondaryInsurance: patient && secondaryInsurance.length > 0 ? secondaryInsurance : null,
    organizationId,
  };
  const existingId = await findUserIdByEmail(email);

  try {
    if (mode === "signup" && !existingId) {
      await db.$transaction(async (tx) => {
        const created = await tx.user.create({ data });
        await tx.account.updateMany({ where: { userId }, data: { userId: created.id } });
        await tx.session.updateMany({ where: { userId }, data: { userId: created.id } });
        await tx.post.updateMany({ where: { createdById: userId }, data: { createdById: created.id } });
        await tx.provider.updateMany({
          where: { userId },
          data: { userId: created.id, organizationId },
        });
        await tx.patient.updateMany({ where: { userId }, data: { userId: created.id } });
        await tx.user.delete({ where: { id: userId } });
      });
      return null;
    }

    if (existingId && existingId !== userId) {
      return { error: "That email is already in use." };
    }

    await db.user.update({ where: { id: userId }, data });
    await db.provider.updateMany({ where: { userId }, data: { organizationId } });
  } catch (error) {
    if (isUniqueEmail(error)) return { error: "That email is already in use." };
    throw error;
  }
  return null;
}
