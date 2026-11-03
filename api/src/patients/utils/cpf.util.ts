export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const firstDigit = calculateVerifierDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateVerifierDigit(
    [...digits.slice(0, 9), firstDigit],
    11,
  );

  return digits[9] === firstDigit && digits[10] === secondDigit;
}

function calculateVerifierDigit(
  digits: number[],
  initialWeight: number,
): number {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (initialWeight - index),
    0,
  );
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}
