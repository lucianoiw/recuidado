"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type NavItem = { href: string; label: string; icon: ReactNode };

/** Floating bottom navigation for the family screens. Pair with <Screen withNav>. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-0 bottom-0 px-4 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <ul
        className="mx-auto grid max-w-md gap-1 rounded-full bg-ink p-1.5 shadow-[0_8px_24px_rgba(22,19,20,0.18)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[12px] font-medium no-underline transition-colors",
                  active ? "bg-surface text-ink" : "text-white/75 hover:text-white",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
