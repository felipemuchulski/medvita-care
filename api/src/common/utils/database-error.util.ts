type DatabaseError = {
  code?: string;
};

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as DatabaseError).code === "23505"
  );
}

export function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as DatabaseError).code === "23P01"
  );
}
