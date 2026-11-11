/**
 * Normalizes a Brazilian phone number to E.164 (+55DDNNNNNNNNN).
 * Accepts "+55 11 91234-5678", "11912345678", "5511912345678".
 */
export function toE164(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && !digits.startsWith("55")) {
    if (digits.length < 8 || digits.length > 15) throw new Error(`Invalid phone number: ${input}`);
    return `+${digits}`;
  }
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits.replace(/^0/, "");
  if (national.length !== 10 && national.length !== 11) {
    throw new Error(`Invalid Brazilian phone number: ${input}`);
  }
  return `+55${national}`;
}
