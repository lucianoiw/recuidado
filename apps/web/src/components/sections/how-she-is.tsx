import { howSheIs } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Photo } from "@/components/ui/photo";
import { Fine, Text } from "@/components/ui/text";
import styles from "./how-she-is.module.css";

export function HowSheIs() {
  return (
    <Container as="section" className={styles.section}>
      <Photo name="fixo" className={styles.photo} />
      <div className={styles.copy}>
        <Heading className={styles.title}>{howSheIs.title}</Heading>
        <blockquote className={styles.quote}>{howSheIs.quote}</blockquote>
        {howSheIs.paragraphs.map((p) => (
          <Text key={p}>{p}</Text>
        ))}
        <Fine>{howSheIs.fine}</Fine>
      </div>
    </Container>
  );
}
