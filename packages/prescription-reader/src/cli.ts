import { loadPrescriptionFile, readPrescription } from "./read-prescription.ts";

const path = process.argv[2];
if (!path) {
  console.error("Uso: pnpm read <caminho-da-receita.(png|jpg|webp|pdf)>");
  process.exit(1);
}

const result = await readPrescription(await loadPrescriptionFile(path));
console.log(JSON.stringify(result, null, 2));
