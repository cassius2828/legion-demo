export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function ageFromDate(date: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const month = today.getUTCMonth() - date.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < date.getUTCDate())) {
    age -= 1;
  }
  return age;
}
