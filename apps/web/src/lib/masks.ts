const digits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

/** (11) 98765-4321 or (11) 3456-7890 */
export function maskPhone(value: string): string {
  const d = digits(value, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  if (rest.length <= split) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** 01310-100 */
export function maskCep(value: string): string {
  const d = digits(value, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** 12/03/1958 */
export function maskDate(value: string): string {
  const d = digits(value, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

export const isPhone = (v: string) => /^\(\d{2}\) \d{4,5}-\d{4}$/.test(v);
export const isCep = (v: string) => /^\d{5}-\d{3}$/.test(v);
export function isDate(v: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && y > 1900 && date < new Date();
}
