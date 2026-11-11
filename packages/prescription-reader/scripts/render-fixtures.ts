/**
 * Renders the synthetic prescriptions of Dona Maria (fictional, 68 years old) to PNG.
 * Every name, registry number and address here is invented for the demo.
 * Requires Playwright with Chromium installed (not a package dependency).
 */
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "fixtures");
const require = createRequire(import.meta.url);
// Inlined as a data URL because pages set with setContent cannot load file:// fonts.
const caveatUrl = `data:font/woff2;base64,${(
  await readFile(require.resolve("@fontsource/caveat/files/caveat-latin-500-normal.woff2"))
).toString("base64")}`;

const PATIENT = "Maria Helena Duarte";
const SYNTHETIC_NOTICE = "Documento sintético para demonstração. Paciente e médico fictícios.";

const baseStyle = `
  @font-face { font-family: "Hand"; src: url("${caveatUrl}") format("woff2"); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #d9d4c7; padding: 28px; font-family: "DejaVu Serif", serif; color: #1d1d1d; }
  .page { width: 760px; min-height: 1000px; background: #fffef8; padding: 48px 56px; position: relative;
          box-shadow: 0 6px 18px rgba(0,0,0,.25); }
  .notice { position: absolute; bottom: 18px; left: 56px; right: 56px; font: 11px "DejaVu Sans", sans-serif;
            color: #9a9a9a; text-align: center; }
`;

interface Fixture {
  name: string;
  html: string;
}

const typedUbs: Fixture = {
  name: "receita-01-ubs-digitada",
  html: `<style>${baseStyle}
    header { border-bottom: 2px solid #2c5f8a; padding-bottom: 14px; margin-bottom: 28px; }
    header h1 { font: bold 20px "DejaVu Sans", sans-serif; color: #2c5f8a; }
    header p { font: 13px "DejaVu Sans", sans-serif; color: #444; }
    .title { text-align: center; font: bold 18px "DejaVu Sans", sans-serif; letter-spacing: 2px; margin-bottom: 24px; }
    .patient { font-size: 16px; margin-bottom: 26px; }
    ol { padding-left: 22px; font-size: 16px; line-height: 1.55; }
    li { margin-bottom: 22px; }
    .qty { float: right; }
    .sign { margin-top: 70px; text-align: center; font-size: 14px; }
    .sign hr { width: 300px; margin: 0 auto 6px; border: 0; border-top: 1px solid #333; }
  </style>
  <div class="page">
    <header>
      <h1>Unidade Básica de Saúde Jardim das Acácias</h1>
      <p>Secretaria Municipal de Saúde · Rua Fictícia, 100 · Telefone (00) 0000-0000</p>
    </header>
    <div class="title">RECEITUÁRIO</div>
    <div class="patient"><b>Paciente:</b> ${PATIENT} &nbsp;&nbsp; <b>Idade:</b> 68 anos</div>
    <ol>
      <li>Losartana potássica 50 mg <span class="qty">60 comprimidos</span><br>
          Tomar 1 comprimido por via oral de 12 em 12 horas. Uso contínuo.</li>
      <li>Cloridrato de metformina 850 mg <span class="qty">60 comprimidos</span><br>
          Tomar 1 comprimido após o café da manhã e 1 comprimido após o jantar. Uso contínuo.</li>
      <li>Rosuvastatina cálcica 10 mg <span class="qty">30 comprimidos</span><br>
          Tomar 1 comprimido à noite. Uso contínuo.</li>
    </ol>
    <p style="margin-top:28px;font-size:15px">Data: 03/11/2026</p>
    <div class="sign"><hr>Dr. Ricardo Albuquerque Lima<br>Clínica Médica · CRM-SP 000001</div>
    <div class="notice">${SYNTHETIC_NOTICE}</div>
  </div>`,
};

const handwritten: Fixture = {
  name: "receita-02-manuscrita",
  html: `<style>${baseStyle}
    body { padding: 40px; }
    .page { transform: rotate(-2.2deg); background: #fffdf2; }
    .head { font: 15px "DejaVu Sans", sans-serif; color: #3a3a3a; border-bottom: 1px solid #bbb; padding-bottom: 10px; }
    .hand { font-family: "Hand", cursive; font-size: 30px; line-height: 1.35; color: #1b2a6b; }
    .hand p { margin: 18px 0; }
    .rx { font: bold 34px "DejaVu Serif", serif; margin: 22px 0 4px; }
  </style>
  <div class="page">
    <div class="head"><b>Consultório Dra. Beatriz Monteiro Sales</b> · Cardiologia · CRM-SP 000002<br>
      Av. Inventada, 2000, sala 12 · (00) 0000-0001</div>
    <div class="rx">Rx</div>
    <div class="hand">
      <p>Sra. ${PATIENT}</p>
      <p>Uso oral</p>
      <p>1) Glifage XR 500mg ———— 2 cx<br>&nbsp;&nbsp;&nbsp;2 cp VO no jantar. Uso contínuo</p>
      <p>2) Hidroclorotiazida 25mg ———— 1 cx<br>&nbsp;&nbsp;&nbsp;1 cp VO pela manhã</p>
      <p>3) AAS 100mg ———— 1 cx<br>&nbsp;&nbsp;&nbsp;1 cp após o almoço</p>
      <p style="margin-top:40px">10/11/26 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span style="font-size:36px">B. M. Sales</span></p>
    </div>
    <div class="notice">${SYNTHETIC_NOTICE}</div>
  </div>`,
};

const insulin: Fixture = {
  name: "receita-03-insulina-e-sos",
  html: `<style>${baseStyle}
    header { text-align: center; margin-bottom: 30px; font-family: "DejaVu Sans", sans-serif; }
    header h1 { font-size: 19px; } header p { font-size: 13px; color: #555; }
    .block { font-size: 16px; line-height: 1.6; margin-bottom: 22px; }
    .label { font: bold 14px "DejaVu Sans", sans-serif; text-transform: uppercase; color: #555; margin: 26px 0 10px; }
  </style>
  <div class="page">
    <header><h1>Ambulatório de Endocrinologia · Hospital Exemplo</h1>
      <p>Dr. Ricardo Albuquerque Lima · CRM-SP 000001</p></header>
    <div class="block"><b>Paciente:</b> ${PATIENT} · 68 anos · Data: 05/11/2026</div>
    <div class="label">Uso subcutâneo</div>
    <div class="block">1. Insulina humana NPH 100 UI/mL, frasco de 10 mL ....... 2 frascos<br>
      Aplicar 10 UI SC antes do café da manhã e 6 UI SC antes do jantar. Uso contínuo.</div>
    <div class="label">Uso oral</div>
    <div class="block">2. Dipirona monoidratada 500 mg ....... 1 caixa<br>
      Tomar 1 comprimido de 6/6h se dor ou febre.</div>
    <div class="label">Orientações</div>
    <div class="block">Caminhada leve de 30 minutos por dia. Medir glicemia capilar em jejum e trazer anotações no retorno em 3 meses.</div>
    <div class="notice">${SYNTHETIC_NOTICE}</div>
  </div>`,
};

// Playwright is loaded at runtime from the environment, so it is not typed here.
interface Page {
  setContent(html: string, options: { waitUntil: "networkidle" }): Promise<void>;
  evaluate(fn: () => unknown): Promise<unknown>;
  locator(selector: string): { screenshot(options: { path: string; type: "png" }): Promise<unknown> };
}
interface Browser {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<Page>;
  close(): Promise<void>;
}
const { chromium } = require("playwright") as { chromium: { launch(): Promise<Browser> } };
await mkdir(fixturesDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 860, height: 1100 }, deviceScaleFactor: 1.5 });
for (const fixture of [typedUbs, handwritten, insulin]) {
  await page.setContent(`<!doctype html><meta charset="utf-8">${fixture.html}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const path = join(fixturesDir, `${fixture.name}.png`);
  await page.locator("body").screenshot({ path, type: "png" });
  console.log(`rendered ${path}`);
}
await browser.close();
