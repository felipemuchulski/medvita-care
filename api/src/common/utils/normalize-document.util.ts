export function normalizedDocument(document: string): string {
  return document
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
