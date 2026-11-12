"use client";

import { useRef, useState } from "react";
import { CameraIcon, InfoIcon } from "@/components/ui";
import { removeMedicationPhoto, setMedicationPhoto, type Medication } from "@/lib/api";

/** Longest side of the photo sent to the API: enough to read the box, small on mobile data. */
const MAX_SIDE = 1280;

/** Shrinks the camera photo to a JPEG before upload (phones take 4 to 12 MB photos). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}

/**
 * Optional photo of the real box or pill. Her screen shows only this photo, never a generic
 * picture, so she does not mistake one pill for another. Saved right away, apart from the form.
 */
export function MedPhotoField({ med, onChanged }: { med: Medication; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(med.photoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, next: string | null) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setPreview(next);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não deu para salvar a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    const photo = await shrink(file);
    await run(() => setMedicationPhoto(med.id, photo), URL.createObjectURL(photo));
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] font-bold">Foto do remédio de verdade</span>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed R2 link or a local blob
        <img
          src={preview}
          alt={`Foto de ${med.name}`}
          className="h-44 w-full rounded-2xl border border-line bg-surface object-contain"
        />
      ) : (
        <p className="flex items-start gap-2 text-[14px] leading-snug text-muted">
          <InfoIcon size={18} className="mt-0.5 shrink-0" />
          Tire uma foto da caixa ou do comprimido que ela toma. O app dela mostra só essa foto. Sem foto,
          mostra só o nome, a dose e o horário.
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-surface px-3 text-[16px] font-bold disabled:opacity-60"
        >
          <CameraIcon size={20} />
          {busy ? "Salvando..." : preview ? "Trocar foto" : "Tirar foto"}
        </button>
        {preview ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => removeMedicationPhoto(med.id), null)}
            className="min-h-11 rounded-xl px-3 text-[16px] font-bold text-danger disabled:opacity-60"
          >
            Apagar foto
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
