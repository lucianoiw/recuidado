import { closing, signUpLabel } from "@/content/site";
import { links } from "@/lib/links";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Photo } from "@/components/ui/photo";
import { Text } from "@/components/ui/text";
import styles from "./closing.module.css";

export function Closing() {
  return (
    <Container as="section" className={styles.section}>
      <div className={styles.frame}>
        <Photo name="filhaSorrindo" className={styles.photo} />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.copy}>
          <Heading className={styles.title}>{closing.title}</Heading>
          <Text>{closing.text}</Text>
          <div>
            <ButtonLink href={links.signUp}>{signUpLabel}</ButtonLink>
          </div>
        </div>
      </div>
    </Container>
  );
}
