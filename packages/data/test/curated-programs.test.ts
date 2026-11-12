import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCuratedPrograms } from "../src/build-curated-programs.ts";
import { PROGRAMS_DIR, seedProgramIndex } from "../src/programs.ts";

describe("curated programs (Remédio em Casa, Dose Certa, AMG, Vale Mais Saúde)", () => {
  const index = seedProgramIndex();
  const ids = (activeIngredient: string, strength: string, name?: string) =>
    index.find(activeIngredient, strength, name, { age: 68, cityIbge: "3550308" }).programs.map((p) => p.programId);

  it("the seed files are the output of the builder", () => {
    for (const file of buildCuratedPrograms()) {
      const onDisk = JSON.parse(readFileSync(join(PROGRAMS_DIR, `${file.program.id}.json`), "utf8"));
      expect(onDisk).toEqual(JSON.parse(JSON.stringify(file)));
    }
  });

  it("losartana 50 mg can come home every 90 days", () => {
    expect(ids("Losartana Potássica", "50 mg")).toContain("remedio_em_casa_sp");
  });

  it("captopril is free at Dose Certa", () => {
    expect(ids("Captopril", "25 mg")).toContain("dose_certa_sp");
  });

  it("Entresto has Alto Custo and the lab discount, and the discount is never free", () => {
    const access = index.find("sacubitril + valsartana", "50 mg", "Entresto", { age: 68 });
    const programs = access.programs.map((p) => p.programId);
    expect(programs).toEqual(expect.arrayContaining(["ceaf_sp", "vale_mais_saude"]));
    expect(access.freeAt).toEqual([]);
    expect(access.programs.find((p) => p.programId === "vale_mais_saude")?.kind).toBe("discount");
  });

  it("NPH insulin points to the AMG supplies", () => {
    expect(ids("Insulina humana NPH", "100 UI/mL")).toContain("amg_sp");
  });

  it("Tegretol CR matches the discount, a plain carbamazepine does not", () => {
    expect(ids("Carbamazepina", "200 mg")).not.toContain("vale_mais_saude");
  });

  it("gliclazida 60 mg (only sold as modified release) still matches without MR on the prescription", () => {
    expect(ids("Gliclazida", "60 mg")).toContain("remedio_em_casa_sp");
    expect(ids("Gliclazida", "60 mg", "Gliclazida MR")).toContain("remedio_em_casa_sp");
    expect(ids("Carbamazepina", "200 mg", "Tegretol CR")).toContain("vale_mais_saude");
  });
});
