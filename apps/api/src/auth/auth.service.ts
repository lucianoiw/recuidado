import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, desc, eq, gt, gte, isNull, ne } from 'drizzle-orm';
import { Resend } from 'resend';
import { type Database, DB, DEMO_FAMILY, families, loginCodes, members, sessions, telemetry } from '@recuidado/core';
import type { AuthContext } from './auth.context.js';
import { inviteEmail, signInEmail, type AuthEmail } from './auth-email.js';
import { codeHash, newCode, newLinkToken, newPatientToken, newSessionToken, normalizeEmail, sha256 } from './tokens.js';

const CODE_MINUTES = 15;
const INVITE_DAYS = 7;
const SESSION_DAYS = 60;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 6;

export interface SignedIn {
  /** Goes in "Authorization: Bearer <token>". */
  token: string;
  me: Me;
}

export interface Me {
  email: string;
  /** Null until the sign-up is saved. */
  memberId: string | null;
  name: string | null;
  familyId: string | null;
}

/**
 * E-mail sign-in for caregivers: a 6 digit code and a link in the same e-mail (Resend), no password.
 * The patient never signs up: the family sends her a link with a secret (/m/<token>).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly resend: Resend | null;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
  }

  private get webUrl(): string {
    return this.config.get<string>('WEB_URL')!;
  }

  /** Sends the sign-in e-mail. Always answers the same, so nobody learns who has an account. */
  async start(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const since = new Date(Date.now() - 60 * 60_000);
    const recent = await this.db
      .select({ id: loginCodes.id })
      .from(loginCodes)
      .where(and(eq(loginCodes.email, email), gte(loginCodes.createdAt, since)));
    if (recent.length >= MAX_CODES_PER_HOUR) {
      throw new HttpException('Muitos códigos pedidos para este e-mail. Espere um pouco e tente de novo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = newCode();
    const link = newLinkToken();
    await this.db.insert(loginCodes).values({
      email,
      codeHash: codeHash(email, code),
      linkHash: sha256(link),
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    });
    await this.send(email, signInEmail({ code, link: this.linkUrl(link), webUrl: this.webUrl }), 'sign_in');
  }

  /** Checks the typed code (with the e-mail) or the link token, and opens a session. */
  async verify(input: { email: string; code: string } | { link: string }): Promise<SignedIn> {
    const now = new Date();
    let row: typeof loginCodes.$inferSelect | undefined;
    if ('link' in input) {
      [row] = await this.db
        .select()
        .from(loginCodes)
        .where(and(eq(loginCodes.linkHash, sha256(input.link)), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, now)));
      if (!row) throw new BadRequestException('Este link já foi usado ou venceu. Peça um código novo.');
    } else {
      const email = normalizeEmail(input.email);
      [row] = await this.db
        .select()
        .from(loginCodes)
        .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, now)))
        .orderBy(desc(loginCodes.createdAt))
        .limit(1);
      if (!row) throw new BadRequestException('O código venceu. Peça um novo.');
      if (row.codeHash !== codeHash(email, input.code.trim())) {
        const attempts = row.attempts + 1;
        await this.db
          .update(loginCodes)
          .set({ attempts, usedAt: attempts >= MAX_ATTEMPTS ? now : null })
          .where(eq(loginCodes.id, row.id));
        throw new BadRequestException(
          attempts >= MAX_ATTEMPTS ? 'Código errado muitas vezes. Peça um novo.' : 'Código errado. Confira no e-mail.',
        );
      }
    }
    await this.db.update(loginCodes).set({ usedAt: now }).where(eq(loginCodes.id, row.id));

    const member = await this.memberOf(row.email);
    if (member && !member.joinedAt) {
      // An invited person signing in for the first time has joined the family.
      await this.db.update(members).set({ joinedAt: now }).where(eq(members.id, member.id));
    }
    const token = newSessionToken();
    const [session] = await this.db
      .insert(sessions)
      .values({
        tokenHash: sha256(token),
        email: row.email,
        memberId: member?.id ?? null,
        expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
      })
      .returning({ id: sessions.id });
    telemetry.capture('signed_in', { newUser: !member, via: 'link' in input ? 'link' : 'code' }, member?.id ?? session.id);
    return {
      token: `s.${token}`,
      me: { email: row.email, memberId: member?.id ?? null, name: member?.name ?? null, familyId: member?.familyId ?? null },
    };
  }

  /** The caregiver with this e-mail: the most recent one outside the demo family. */
  private async memberOf(email: string) {
    const [row] = await this.db
      .select({ id: members.id, name: members.name, familyId: members.familyId, joinedAt: members.joinedAt })
      .from(members)
      .innerJoin(families, eq(families.id, members.familyId))
      .where(and(eq(members.email, email), eq(members.role, 'caregiver'), ne(families.name, DEMO_FAMILY)))
      .orderBy(desc(members.createdAt))
      .limit(1);
    return row;
  }

  async me(auth: AuthContext & { kind: 'caregiver' }): Promise<Me> {
    if (!auth.memberId) return { email: auth.email, memberId: null, name: null, familyId: null };
    const [m] = await this.db.select({ name: members.name }).from(members).where(eq(members.id, auth.memberId));
    return { email: auth.email, memberId: auth.memberId, name: m?.name ?? null, familyId: auth.familyId };
  }

  async signOut(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  /** After the sign-up creates the caregiver, the session points to them. */
  async attach(sessionId: string, memberId: string): Promise<void> {
    await this.db.update(sessions).set({ memberId }).where(eq(sessions.id, sessionId));
  }

  /**
   * Someone opened an invite shared by WhatsApp (no e-mail on the invite) and signed in: the pending
   * invite with that name in that family becomes this person.
   */
  async claimInvite(auth: AuthContext & { kind: 'caregiver' }, familyId: string, name: string): Promise<Me> {
    const key = name.trim().toLocaleLowerCase('pt-BR');
    const pending = await this.db
      .select({ id: members.id, name: members.name, email: members.email })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver'), isNull(members.joinedAt)))
      .orderBy(asc(members.createdAt));
    const invite = pending.find(
      (m) => m.name.trim().toLocaleLowerCase('pt-BR') === key && (!m.email || m.email === auth.email),
    );
    if (!invite) throw new NotFoundException('Convite não encontrado. Peça um novo para quem chamou você.');
    await this.db.update(members).set({ email: auth.email, joinedAt: new Date() }).where(eq(members.id, invite.id));
    await this.attach(auth.sessionId, invite.id);
    return { email: auth.email, memberId: invite.id, name: invite.name, familyId };
  }

  /** E-mail to an invited caregiver, with a link that signs them in for 7 days. */
  async sendInvite(to: string, from: string, patient: string): Promise<void> {
    const email = normalizeEmail(to);
    const link = newLinkToken();
    await this.db.insert(loginCodes).values({
      email,
      // Invites have no code to type: a random hash nobody can match.
      codeHash: sha256(newLinkToken()),
      linkHash: sha256(link),
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    });
    await this.send(email, inviteEmail({ from, patient, link: this.linkUrl(link), webUrl: this.webUrl }), 'invite');
  }

  /** The secret of the patient link, created on first use. `renew` makes a new one and the old stops working. */
  async patientToken(patientId: string, renew = false): Promise<string> {
    if (!renew) {
      const [row] = await this.db.select({ token: members.accessToken }).from(members).where(eq(members.id, patientId));
      if (row?.token) return row.token;
    }
    const token = newPatientToken();
    await this.db.update(members).set({ accessToken: token }).where(eq(members.id, patientId));
    return token;
  }

  private linkUrl(token: string): string {
    return new URL(`/entrar/link?t=${encodeURIComponent(token)}`, this.webUrl).toString();
  }

  private async send(to: string, email: AuthEmail, kind: 'sign_in' | 'invite'): Promise<void> {
    if (!this.resend) {
      // Local development: the e-mail goes to the log.
      this.logger.log(`RESEND_API_KEY not set. ${kind} e-mail to ${to}:\n${email.text}`);
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.config.get<string>('EMAIL_FROM')!,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) {
      this.logger.error(`${kind} e-mail not sent: ${error.message}`);
      telemetry.capture('auth_email_failed', { kind, error: error.message });
      if (kind === 'sign_in') throw new HttpException('Não deu para enviar o e-mail agora. Tente de novo.', HttpStatus.BAD_GATEWAY);
    }
  }
}
