import { z } from 'zod';

// Same list as apps/web/src/lib/onboarding.ts.
export const RELATIONS = [
  'Filho(a)',
  'Neto(a)',
  'Sobrinho(a)',
  'Cônjuge',
  'Irmão(ã)',
  'Genro/Nora',
  'Cuidador(a) profissional',
  'Amigo(a)/Vizinho(a)',
  'Outro',
] as const;

const relation = z.enum(RELATIONS);
const name = z.string().trim().min(2, 'Informe o nome.').max(80);
const phone = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{10,11}$/, 'Telefone com DDD.'));
const cep = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{8}$/, 'CEP com 8 dígitos.'));
// Accepts dd/mm/aaaa (what the form shows) or aaaa-mm-dd; stored as aaaa-mm-dd.
const birth = z
  .string()
  .transform((v) => {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    return br ? `${br[3]}-${br[2]}-${br[1]}` : v;
  })
  .pipe(
    z.iso.date('Data de nascimento inválida.').refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return d.getUTCFullYear() > 1900 && d < new Date();
    }, 'Data de nascimento inválida.'),
  );

/** Body of PUT /family/onboarding: the answers of the 4 sign-up steps. */
export const onboardingBody = z
  .object({
    // The caregiver saved earlier from this device. Missing or unknown creates a new caregiver.
    caregiverId: z.uuid().nullish(),
    caregiver: z.object({
      name,
      phone,
      // Optional: alerts also go by e-mail.
      email: z.union([z.email('E-mail inválido.').trim().toLowerCase().max(120), z.literal('')]).default(''),
      relation,
      relationOther: z.string().trim().max(60).default(''),
    }),
    patient: z.object({
      name,
      nickname: z.string().trim().max(40).default(''),
      // "A senhora" or "O senhor" on the call.
      gender: z.enum(['female', 'male']).default('female'),
      phone,
      birth,
      cep,
      usesPhone: z.boolean(),
      // The caregiver says she agreed to reminders, calls and the family seeing her doses (LGPD art. 11).
      consent: z.boolean().default(false),
    }),
    invites: z
      .array(
        z.object({
          name,
          relation: relation.nullable().default(null),
          phone: z.union([phone, z.literal('')]).optional(),
        }),
      )
      .max(20)
      .default([]),
  })
  .refine((b) => b.caregiver.relation !== 'Outro' || b.caregiver.relationOther !== '', {
    message: 'Diga qual é a relação.',
    path: ['caregiver', 'relationOther'],
  });

export type OnboardingBody = z.infer<typeof onboardingBody>;

export const buyChoiceBody = z.object({ buy: z.boolean() });

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário no formato 08:00.');

/** Pills at home, as counted by the family. */
export const stockUnits = z
  .number('Informe quantos comprimidos.')
  .int('Só números inteiros.')
  .min(0, 'Não pode ser negativo.')
  .max(1000, 'No máximo 1000.');

/** Family edits a medication: dose text, times of day and/or pills at home (null clears the count). */
export const medicationUpdateBody = z
  .object({
    strength: z.string().trim().max(60).nullable().optional(),
    times: z.array(clock).min(1, 'Pelo menos um horário.').max(6).optional(),
    stockUnits: stockUnits.nullable().optional(),
  })
  .refine((b) => b.strength !== undefined || b.times !== undefined || b.stockUnits !== undefined, {
    message: 'Nada para mudar.',
  });

export type MedicationUpdateBody = z.infer<typeof medicationUpdateBody>;

const isoDay = z.iso.date('Data no formato AAAA-MM-DD.');

/** Alto Custo path: checklist items the family has, LME date and approval date (null clears). */
export const highCostBody = z
  .object({
    checked: z.array(z.string().regex(/^[a-z_]{1,40}$/)).max(30).optional(),
    lmeFilledOn: isoDay.nullable().optional(),
    since: isoDay.nullable().optional(),
  })
  .refine((b) => b.checked !== undefined || b.lmeFilledOn !== undefined || b.since !== undefined, {
    message: 'Nada para mudar.',
  });

export type HighCostBody = z.infer<typeof highCostBody>;
