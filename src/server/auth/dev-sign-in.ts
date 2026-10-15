import { db } from "~/server/db";

export const DEV_PASSWORD = "123";

function localName(email: string) {
  const name = email.split("@")[0];
  if (!name) return "New user";
  return name;
}

export async function userForDevSignIn(emailInput: string) {
  const email = emailInput.trim();
  const normalized = email.toLowerCase();
  if (!normalized.includes("@")) return null;

  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  let match = users.find((item) => item.email?.toLowerCase() === normalized);

  if (!match) {
    const created = await db.user.create({
      data: { email, name: localName(email) },
      select: { id: true, name: true, email: true, role: true },
    });
    match = created;
  }

  const linked = await linkClinicalLogin(match.id, normalized);
  return linked ?? match;
}

async function linkClinicalLogin(
  userId: string,
  email: string,
) {
  const [providers, patients] = await Promise.all([
    db.provider.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, userId: true, credentials: true },
    }),
    db.patient.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, userId: true },
    }),
  ]);
  const provider = providers.find((item) => item.email.toLowerCase() === email);
  const patient = patients.find((item) => item.email.toLowerCase() === email);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return null;

  if (provider?.userId === null) {
    await db.provider.update({ where: { id: provider.id }, data: { userId } });
  }
  if (patient?.userId === null) {
    await db.patient.update({ where: { id: patient.id }, data: { userId } });
  }

  const chart = provider ?? patient;
  if (!user.role && chart) {
    const role = provider
      ? provider.credentials === "PMHNP"
        ? "nurse"
        : "psychiatrist"
      : "patient";
    return db.user.update({
      where: { id: userId },
      data: {
        role,
        name: user.name ?? `${chart.firstName} ${chart.lastName}`,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  return user;
}
