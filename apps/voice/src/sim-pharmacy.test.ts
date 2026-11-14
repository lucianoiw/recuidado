import { test } from "node:test";
import assert from "node:assert/strict";
import { SIM_PHARMACIES, actorNumber, buildActorInstructions, simFacts, simPharmacyFor, simPriceCents, spokenPrice } from "./sim-pharmacy.js";
import { LiveClient } from "./live.js";
import type { VoiceConfig } from "./config.js";

const losartana = { name: "Losartana", dose: "50 mg", refPackCents: 1232, unitsPerPack: 28 };

test("only +550000000001N are simulated pharmacies", () => {
  assert.equal(simPharmacyFor("+5500000000011")?.name, "Drogaria Vida");
  assert.equal(simPharmacyFor("+5500000000013")?.index, 3);
  assert.equal(simPharmacyFor("+5500000000000"), undefined);
  assert.equal(simPharmacyFor("+5511912345678"), undefined);
  assert.equal(actorNumber(SIM_PHARMACIES[1]), "+5500000000092");
});

test("each pharmacy says a different shelf price, ending in ,90", () => {
  const prices = SIM_PHARMACIES.map((p) => simPriceCents(p, losartana));
  assert.equal(new Set(prices).size, 3);
  for (const c of prices) assert.equal(c % 100, 90);
  assert.equal(simPriceCents(SIM_PHARMACIES[1], losartana), Math.min(...prices));
});

test("facts follow stock and never mention Farmácia Popular", () => {
  const meds = [losartana, { name: "Metformina", dose: "850 mg" }];
  const facts = simFacts(SIM_PHARMACIES[2], meds);
  assert.match(facts[0], /^Losartana 50 mg: tem\. GENÉRICO: R\$ \d+,90 \("[a-zé ]+ e noventa"\)\. REFERÊNCIA: R\$ \d+,90 \("[a-zé ]+ e noventa"\)\. Caixa com 28 comprimidos\. Answer: "Temos sim\. O genérico sai [a-zé ]+ e noventa, o de referência sai [a-zé ]+ e noventa, caixa com 28 comprimidos\."$/);
  assert.match(facts[1], /em falta/);
  assert.doesNotMatch(simFacts(SIM_PHARMACIES[1], meds).join(" "), /Farmácia Popular/);
  assert.match(buildActorInstructions(SIM_PHARMACIES[0], [losartana]), /Drogaria Vida, (bom dia|boa tarde|boa noite), Rafael falando/);
});

test("the actor speaks with the actor voice and has no tools", () => {
  const config = {
    openaiApiKey: "k",
    liveModel: "gpt-live-1",
    liveVoice: "bossa",
    actorVoice: "tempo",
    patientActorVoice: "tempo",
    delegateModel: "gpt-6-luna",
    sip: { providerUrl: "sips:x:5061", username: "openai", password: "p", callerNumber: "+551100000000" },
    allowedNumbers: new Set<string>(),
    allowAnyBrazilian: false,
    maxCallSeconds: 150,
    port: 0,
    voiceApiToken: "t",
    pharmacyDecisions: true,
    recordCalls: false,
  } satisfies VoiceConfig;
  const req = new LiveClient(config).buildActorSessionRequest("+5500000000091", "x", "Drogaria Vida, boa tarde.");
  assert.equal(req.session.audio.output.voice, "tempo");
  assert.equal("delegation" in req.session, false);
  assert.equal(req.transport.destination, "+5500000000091");
});

test("prices are spelled the way an attendant says them", () => {
  assert.equal(spokenPrice(790), "sete e noventa");
  assert.equal(spokenPrice(1390), "treze e noventa");
  assert.equal(spokenPrice(2490), "vinte e quatro e noventa");
  assert.equal(spokenPrice(3000), "trinta reais");
});
