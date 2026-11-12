/* eslint-disable @next/next/no-img-element -- photos are already sized for the page */
import { photos, type PhotoName } from "@/content/photos";
import styles from "./photo.module.css";

// Rounded photo that fills its column. The section sets height and focus point in className.
export function Photo({ name, className, priority = false }: { name: PhotoName; className?: string; priority?: boolean }) {
  const { src, width, height } = photos[name];
  return (
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={className ? `${styles.photo} ${className}` : styles.photo}
    />
  );
}
