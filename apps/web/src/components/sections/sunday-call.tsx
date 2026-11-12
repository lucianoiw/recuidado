import { sundayCall } from "@/content/site";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Photo } from "@/components/ui/photo";
import { Text } from "@/components/ui/text";
import styles from "./sunday-call.module.css";

export function SundayCall() {
  return (
    <Container as="section" className={styles.section}>
      <div className={styles.frame}>
        <Photo name="almoco" className={styles.photo} />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.copy}>
          <Heading className={styles.title}>{sundayCall.title}</Heading>
          <Text size="md" className={styles.text}>
            {sundayCall.text}
          </Text>
          <p className={styles.fine}>{sundayCall.fine}</p>
        </div>
      </div>
    </Container>
  );
}
