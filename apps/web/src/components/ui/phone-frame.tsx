import type { ReactNode } from "react";
import styles from "./phone-frame.module.css";

// Android phone drawn in CSS around a mock screen. "dark" is 290 px wide, "light" 280 px.
export function PhoneFrame({ tone = "dark", time = "8:00", className, children }: { tone?: "dark" | "light"; time?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`${styles.frame} ${styles[tone]}${className ? ` ${className}` : ""}`}>
      <div className={styles.bezel}>
        <div className={styles.screen}>
          <div className={styles.statusBar} aria-hidden="true">
            <span>{time}</span>
            <span className={styles.camera} />
            <span className={styles.icons}>
              <span className={styles.signal} />
              <span className={styles.battery} />
            </span>
          </div>
          {children}
          <span className={styles.homeBar} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
