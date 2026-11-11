import { z } from 'zod';

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário no formato HH:MM.');
const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

/** Body of POST /prescriptions/confirm: the items the family reviewed after the reading. */
export const confirmPrescriptionBody = z.object({
  patientId: z.uuid(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Informe o nome do remédio.'),
        activeIngredient: optionalText,
        strength: optionalText,
        // Empty for as-needed medicines: they are saved without reminders.
        times: z.array(time).max(12),
        // Pills at home, when the family knows. Feeds the "remédio acabando" alert.
        stockUnits: z.number().int().min(0).max(1000).nullish(),
      }),
    )
    .min(1, 'Confirme ao menos um remédio.')
    .max(30),
});

export type ConfirmPrescriptionBody = z.infer<typeof confirmPrescriptionBody>;
