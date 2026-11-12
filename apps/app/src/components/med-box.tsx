import type { Medication } from "@/lib/api";
import { cn } from "@/components/ui";

const FORMS_PLURAL: Record<string, string> = {
  comprimido: "comprimidos",
  "comprimido revestido": "comprimidos revestidos",
  cápsula: "cápsulas",
  drágea: "drágeas",
};

/**
 * Drawn medicine box for the family screens while there is no photo: one AI-made blank box,
 * with the name, substance, strength, generic band and prescription stripe written by code.
 * Never on her screen: she sees only the photo the family took.
 */
export function MedBox({ med, className }: { med: Medication; className?: string }) {
  const box = med.box;
  const title = box?.title ?? med.name;
  const longest = Math.max(...title.split(" ").map((w) => w.length), 5);
  const nameSize = Math.min(11, 78 / longest);
  const form = box?.form ? (FORMS_PLURAL[box.form] ?? box.form) : null;
  return (
    <div
      aria-hidden="true"
      className={cn("relative shrink-0 overflow-hidden rounded-2xl bg-cream bg-cover bg-center [container-type:inline-size]", className)}
      style={{ backgroundImage: "url(/med-box.jpg)", aspectRatio: "524 / 782" }}
    >
      <div className="absolute top-[7.7%] left-[19.1%] flex h-[84.4%] w-[61.8%] flex-col mix-blend-multiply">
        <div className="flex flex-1 flex-col px-[6cqw] pt-[9cqw] text-[#1d2f5e]">
          <span className="leading-none font-bold tracking-[-0.01em]" style={{ fontSize: `${nameSize}cqw` }}>
            {title}
          </span>
          {box?.substance ? (
            <span className="mt-[1.6cqw] text-[4.2cqw] leading-[1.15] font-semibold text-[#3a5590]">{box.substance}</span>
          ) : null}
          {med.strength ? (
            <span className="mt-[4cqw] text-[11cqw] leading-none font-bold">{med.strength}</span>
          ) : null}
          <span className="mt-[4.5cqw] mb-[3.5cqw] border-t-[0.5cqw] border-[#c9cfdb]" />
          {box?.unitsPerPack && form ? (
            <span className="text-[3.9cqw] leading-[1.35] font-medium text-[#424b5e]">
              {box.unitsPerPack} {form}
            </span>
          ) : null}
          <span className="text-[3.9cqw] leading-[1.35] font-medium text-[#424b5e]">Uso oral</span>
        </div>
        {box?.generic ? (
          <div className="flex items-center gap-[2.4cqw] bg-[#f2c230] px-[4cqw] py-[2.2cqw] text-[3.4cqw] leading-[1.1] font-bold text-[#1d2f5e] uppercase">
            <span className="flex size-[7.5cqw] shrink-0 items-center justify-center rounded-full bg-[#1d4fa3] text-[5cqw] text-white">
              G
            </span>
            <span>
              Medicamento
              <br />
              genérico
            </span>
          </div>
        ) : null}
        {box?.stripe === "red" || box?.stripe === "black" ? (
          <div
            className={cn(
              "px-[3cqw] py-[2.2cqw] text-center text-[2.9cqw] leading-[1.2] font-bold text-white uppercase",
              box.stripe === "red" ? "bg-[#c8102e]" : "bg-[#111]",
            )}
          >
            Venda sob prescrição
            {box.stripe === "black" ? (
              <>
                <br />
                com retenção da receita
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
