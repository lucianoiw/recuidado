"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "./icons";

/** Bottom sheet built on the native <dialog>, so focus and Esc work out of the box. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/45"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-[28px] bg-bg px-6 pt-3 pb-8 text-ink shadow-[0_-10px_30px_rgba(22,32,31,0.18)]">
        <span aria-hidden="true" className="h-1.5 w-11 self-center rounded-full bg-[#cfc8ba]" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[24px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full border border-line-soft bg-surface"
          >
            <XIcon size={20} />
            <span className="sr-only">Fechar</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
