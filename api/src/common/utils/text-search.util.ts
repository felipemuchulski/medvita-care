import { Brackets, ObjectLiteral, SelectQueryBuilder } from "typeorm";

const accents = "àáâãäåèéêëìíîïòóôõöùúûüçñýÿ";
const plain = accents.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Columns are source-code constants, never user input. No extension/schema change.
export function normalizedSearchColumn(column: string): string {
  return `regexp_replace(lower(translate(coalesce(${column}, ''), '${accents + accents.toUpperCase()}', '${plain + plain.toUpperCase()}')), '[\u0300-\u036f]', '', 'g')`;
}

export function applyTextSearch<T extends ObjectLiteral>(
  builder: SelectQueryBuilder<T>,
  columns: string[],
  value?: string,
  cpfColumn?: string,
): void {
  const normalized = normalizeSearch(value ?? "");
  if (!normalized) return;
  const tokens = normalized.split(/\s+/);
  builder.andWhere(
    new Brackets((scope) => {
      scope.where(
        new Brackets((all) => {
          tokens.forEach((token, index) => {
            const parameter = `textSearch${index}`;
            const pattern = `%${token.replace(/[\\%_]/g, "\\$&")}%`;
            all.andWhere(
              new Brackets((any) => {
                columns.forEach((column) => {
                  any.orWhere(
                    `${normalizedSearchColumn(column)} LIKE :${parameter}`,
                    { [parameter]: pattern },
                  );
                });
              }),
            );
          });
        }),
      );
      if (cpfColumn && /^[\d.\-\s]+$/.test(normalized)) {
        const digits = normalized.replace(/\D/g, "");
        if (digits)
          scope.orWhere(`${cpfColumn} LIKE :textSearchCpf`, {
            textSearchCpf: `%${digits}%`,
          });
      }
    }),
  );
}
