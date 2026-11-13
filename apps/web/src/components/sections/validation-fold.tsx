import Link from "next/link";
import { validationFold as f } from "@/content/validation";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { ScoreBoard } from "@/components/validation/score-board";
import styles from "./validation-fold.module.css";

// Home fold: the Tribunal de Ideias validation in short, leading to /validacao.
export function ValidationFold() {
  return (
    <Container as="section" id="validacao" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>{f.eyebrow}</span>
          <Heading className={styles.title}>{f.title}</Heading>
          <Text className={styles.text}>{f.text}</Text>
        </div>
        <ScoreBoard />
        <div className={styles.actions}>
          <Link href="/validacao" className={styles.action}>
            {f.action}
          </Link>
          <span className={styles.fine}>{f.fine}</span>
        </div>
      </div>
    </Container>
  );
}
