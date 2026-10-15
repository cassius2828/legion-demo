export const DEV_ADMIN_EMAIL = "cassius2828@gmail.com";

export function isDevAdmin(email: string | null | undefined) {
  return email?.toLowerCase() === DEV_ADMIN_EMAIL;
}
