/** Modo multi-usuario: OAuth Google + Redis (user → sheetId). */
export function isMultiUserAuthEnabled(): boolean {
  return Boolean(
    process.env.AUTH_SECRET?.trim() &&
      process.env.AUTH_GOOGLE_ID?.trim() &&
      process.env.AUTH_GOOGLE_SECRET?.trim()
  );
}
