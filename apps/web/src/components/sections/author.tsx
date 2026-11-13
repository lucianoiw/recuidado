/* eslint-disable @next/next/no-img-element -- small square photo, already sized */
import { author } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import styles from "./author.module.css";

// Who built the Recuidado: round photo next to the name, two paragraphs side by side.
export function Author() {
  return (
    <Container as="section" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <img src="/fotos/luciano.jpg" alt={author.photoAlt} width={320} height={320} loading="lazy" className={styles.photo} />
          <div className={styles.titles}>
            <span className={styles.eyebrow}>{author.eyebrow}</span>
            <Heading className={styles.name}>{author.name}</Heading>
            <p className={styles.lead}>{author.lead}</p>
          </div>
        </div>
        <div className={styles.columns}>
          <Text className={styles.paragraph}>{author.career}</Text>
          <Text className={styles.paragraph}>{author.ai}</Text>
        </div>
        <div className={styles.links}>
          {author.links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </Container>
  );
}
