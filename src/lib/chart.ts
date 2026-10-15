export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`;
}

export function providerLabel(provider: {
  firstName: string;
  lastName: string;
  credentials: string;
}) {
  return `${fullName(provider)}, ${provider.credentials}`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function ageInYears(dateOfBirth: Date, today = new Date()) {
  let years = today.getFullYear() - dateOfBirth.getUTCFullYear();
  const month = today.getMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && today.getDate() < dateOfBirth.getUTCDate())) {
    years -= 1;
  }
  return years;
}
