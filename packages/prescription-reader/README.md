# @recuidado/prescription-reader

Reads a photo (or PDF) of a Brazilian prescription with Claude and returns structured JSON: medication, active ingredient, strength, dosage form, posology, daily schedule, duration and quantity. The output is ready to be joined with the Farmácia Popular list and the CMED price table, and to create dose reminders.

The reader transcribes; it never makes clinical decisions. Anything guessed or illegible comes back with `needs_review: true` so the family confirms it before reminders are created.

## Model

`claude-opus-5-5`: the strongest vision model in the current Claude lineup for handwritten Portuguese, with native structured outputs, so the JSON always matches the schema. One call per prescription. The request opts into server-side refusal fallback (`fallbacks: "default"`).

## Usage

```ts
import { loadPrescriptionFile, readPrescription } from "@recuidado/prescription-reader";

const { reading } = await readPrescription(await loadPrescriptionFile("receita.jpg"));
for (const item of reading.items) {
  console.log(item.match_key, item.schedule, item.monthly_units);
}
```

From a request body: `readPrescription({ data: buffer, mediaType: "image/jpeg" })`.

Requires `ANTHROPIC_API_KEY` in the environment. Images must be at most 5 MB (resize phone photos on the client).

## Output

Main fields per item (full schema in `src/schema.ts`):

| Field | Example | Used for |
| --- | --- | --- |
| `active_ingredient` | `"cloridrato de metformina"` | Display, lookup |
| `strength` | `{ "value": 850, "unit": "mg" }` | Lookup |
| `match_key` | `"metformina 850 mg"` | Join with Farmácia Popular and CMED (`toMatchKey`) |
| `schedule` | `[{ "time": "08:00", "amount": 1, "anchor": "after_breakfast" }]` | Reminders |
| `frequency.as_needed` | `true` for "se dor" | No reminder |
| `duration.continuous` | `true` for "uso contínuo" | Monthly plan |
| `monthly_units` | `60` | Monthly cost |
| `needs_review`, `review_reason` | `true`, `"Dose ilegível"` | Family confirmation |

Meal cues ("após o café", "à noite") and intervals ("12/12h") become clock times through the routine table in `src/routine.ts` (breakfast 08:00, lunch 12:00, dinner and night 20:00, bedtime 22:00). The same table is sent to the model and used by the code, so both agree.

Close doses share one reminder: any time within 60 minutes of 08:00, 12:00 or 20:00 moves to that time (08:30 becomes 08:00, 21:00 becomes 20:00). Fasting and before-meal doses (`before_breakfast`, `before_lunch`, `before_dinner`, `wake_up`) keep their time, and two doses of the same medicine are never merged into one. The family still reviews every time before confirming.

## Synthetic fixtures

`fixtures/` has three prescriptions of Dona Maria (fictional, 68 years old). Every name, registry number and address is invented.

| File | What it tests |
| --- | --- |
| `receita-01-ubs-digitada.png` | Typed UBS prescription: 12/12h interval, meal cues, "à noite" |
| `receita-02-manuscrita.png` | Handwritten and tilted: brand name (Glifage XR), abbreviations (cp, VO, AAS) |
| `receita-03-insulina-e-sos.png` | Insulin with different amounts per time, as-needed item, non-drug guidance |

`fixtures/expected.json` holds the expected values. Regenerate the images with `pnpm fixtures:render` (needs Playwright with Chromium).

## Scripts

- `pnpm test`: unit tests (no API calls).
- `pnpm eval`: reads every fixture with the real API and compares with `expected.json`. Costs a few cents.
- `pnpm read <file>`: prints the JSON for one prescription.

## In the api

`apps/api` exposes it as `POST /prescriptions/parse` (multipart, photo in the `file` field). It answers the same JSON as `readPrescription`, and 503 when `ANTHROPIC_API_KEY` is not set.

```
curl -F "file=@packages/prescription-reader/fixtures/receita-01-ubs-digitada.png" http://localhost:4000/prescriptions/parse
```

After the family reviews the reading, `POST /prescriptions/confirm` saves the medicines and schedules their doses:

```json
{ "patientId": "<uuid from GET /family>", "items": [{ "name": "Losartana potássica", "activeIngredient": "losartana potássica", "strength": "50 mg", "times": ["08:00", "20:00"] }] }
```

Items with `times: []` (as-needed) are saved without reminders.

The package is consumed through `dist/`, built by the `prepare` script on `pnpm install` (and by `pnpm build`).
