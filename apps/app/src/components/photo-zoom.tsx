"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small photo of the real box that opens full screen when tapped, with a big "Fechar".
 * Only for photos the family took: never a generic picture of a pill.
 */
export function PhotoZoom({ src, name, className }: { src: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver a foto de ${name} grande`}
        className={`relative shrink-0 overflow-hidden rounded-2xl bg-cream ${className ?? ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed R2 link, taken by the family */}
        <img src={src} alt="" className="size-full object-cover" />
        <span
          aria-hidden="true"
          className="absolute right-1 bottom-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </span>
      </button>
      <dialog
        ref={ref}
        aria-label={`Foto de ${name}`}
        onClose={() => setOpen(false)}
        onClick={() => setOpen(false)}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-ink p-0 backdrop:bg-ink"
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col gap-4 px-5 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)]">
          <p className="font-display text-[32px] leading-tight text-white">{name}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed R2 link, taken by the family */}
          <img src={src} alt={`Foto de ${name}`} className="min-h-0 w-full flex-1 rounded-3xl object-contain" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex min-h-16 items-center justify-center gap-3 rounded-full bg-surface text-[24px] font-semibold text-ink"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Fechar
          </button>
        </div>
      </dialog>
    </>
  );
}
