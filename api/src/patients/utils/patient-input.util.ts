export const normalizePatientName = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export function isValidPatientPhone(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value.trim()) return true;
  return (
    /^[\d() .-]+$/.test(value) &&
    [10, 11].includes(value.replace(/\D/g, "").length)
  );
}
