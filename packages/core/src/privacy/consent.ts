import { DEMO_FAMILY } from '../family/demo-family.js';

/** True when the patient may get reminder calls: she (or the family for her) consented, or it is the demo family. */
export function mayContact(consentAt: Date | null, familyName: string): boolean {
  return consentAt !== null || familyName === DEMO_FAMILY;
}
