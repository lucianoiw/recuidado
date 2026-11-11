import { createHash, randomBytes, randomInt } from 'node:crypto';

/** Session token a signed-in device keeps (256 bits). */
export const newSessionToken = () => randomBytes(32).toString('base64url');

/** Secret of the patient link (/m/<token>): 128 bits, short enough to paste. */
export const newPatientToken = () => randomBytes(16).toString('base64url');

/** Secret of the sign-in link inside the e-mail. */
export const newLinkToken = () => randomBytes(24).toString('base64url');

/** 6 digit code typed in the app, for when the e-mail is read on another device. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** The code is hashed with the e-mail, so the same code of two people never matches. */
export const codeHash = (email: string, code: string) => sha256(`${email}:${code}`);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
