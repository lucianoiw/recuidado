import type { ReactNode } from "react";
import styles from "./note-card.module.css";

// White notification-like card with a pink icon, used over photos.
export function NoteCard({ icon, label, className, children }: { icon: ReactNode; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className ? `${styles.card} ${className}` : styles.card}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.body}>
        <span className={styles.label}>{label}</span>
        <span className={styles.text}>{children}</span>
      </span>
    </div>
  );
}
