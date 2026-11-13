/* eslint-disable @next/next/no-img-element -- tiny local SVG, already sized */
import styles from "./model-logo.module.css";

// Round company logo next to an AI model name. Files in public/logos, taken from the
// Tribunal de Ideias report page (Luciano's own product, 13/11/2026).
export function ModelLogo({ name, size = 32 }: { name: string; size?: number }) {
  return <img src={`/logos/${name}.svg`} alt="" width={size} height={size} className={styles.logo} />;
}
