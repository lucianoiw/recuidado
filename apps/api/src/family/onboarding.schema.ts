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
      relation,
      relationOther: z.string().trim().max(60).default(''),
    }),
    patient: z.object({
      name,
      nickname: z.string().trim().max(40).default(''),
      phone,
      birth,
      cep,
      usesPhone: z.boolean(),
    }),
    invites: z
      .array(z.object({ name, relation: relation.nullable().default(null) }))
      .max(20)
      .default([]),
  })
  .refine((b) => b.caregiver.relation !== 'Outro' || b.caregiver.relationOther !== '', {
    message: 'Diga qual é a relação.',
    path: ['caregiver', 'relationOther'],
  });

export type OnboardingBody = z.infer<typeof onboardingBody>;

export const buyChoiceBody = z.object({ buy: z.boolean() });
