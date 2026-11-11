import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Writes rows as RFC 4180 CSV with a header taken from `columns`. Arrays are joined with "|". */
/** Gzips the output when the path ends in ".gz". */
export function writeCsv<T extends object>(path: string, rows: T[], columns: (keyof T & string)[]): void {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => escapeCell(row[column])).join(","));
  const text = `${lines.join("\n")}\n`;
  writeFileSync(path, path.endsWith(".gz") ? gzipSync(text, { level: 9 }) : text);
}

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Parses RFC 4180 CSV (quoted cells, "" escapes). Reads ".gz" files transparently. */
export function readCsv(path: string): Record<string, string>[] {
  const buffer = readFileSync(path);
  const text = (path.endsWith(".gz") ? gunzipSync(buffer) : buffer).toString("utf8");
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  const [header, ...body] = records;
  if (!header) return [];
  return body
    .filter((values) => values.length > 1 || values[0] !== "")
    .map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}
