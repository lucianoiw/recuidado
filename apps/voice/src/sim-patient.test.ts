import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPatientActorInstructions, patientActorNumber, simPatientFor } from "./sim-patient.js";

test("simulated patients: number to scenario, actor number, and the son plays himself", () => {
  assert.equal(simPatientFor("+5500000000021")?.index, 1);
  assert.equal(simPatientFor("+5500000000025")?.index, 5);
  assert.equal(simPatientFor("+5500000000026"), undefined);
  assert.equal(simPatientFor("+5511999999999"), undefined);
  assert.equal(patientActorNumber(simPatientFor("+5500000000023")!), "+5500000000083");
  assert.match(buildPatientActorInstructions(simPatientFor("+5500000000021")!), /Dona Maria, 68/);
  assert.doesNotMatch(buildPatientActorInstructions(simPatientFor("+5500000000025")!), /Dona Maria, 68/);
});
