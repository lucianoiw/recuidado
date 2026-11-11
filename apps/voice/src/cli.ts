// Places one reminder call and prints the result. Usage:
//   node dist/cli.js <phone> <patientName> "<medicine 1>" ["<medicine 2>" ...]
import { loadConfig } from "./config.js";
import { CallService } from "./call-service.js";

const [phone, patientName, ...medicines] = process.argv.slice(2);
if (!phone || !patientName || medicines.length === 0) {
  console.error('Usage: node dist/cli.js <phone> <patientName> "<medicine>" [...]');
  process.exit(1);
}

const service = new CallService(loadConfig());
const { sessionId, call } = await service.start({
  phone,
  patientName,
  medications: medicines.map((name) => ({ name })),
});
console.log(`Calling, session ${sessionId}`);
const result = await call.result;
console.log(JSON.stringify(result, null, 2));
process.exit(0);
