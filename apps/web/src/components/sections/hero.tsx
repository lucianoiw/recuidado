import { hero, signUpLabel } from "@/content/site";
import { links } from "@/lib/links";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { CheckIcon, PhoneIcon } from "@/components/ui/icons";
import { NoteCard } from "@/components/ui/note-card";
import { Photo } from "@/components/ui/photo";
import { Fine, Text } from "@/components/ui/text";
import styles from "./hero.module.css";

export function Hero() {
  return (
    <Container as="section" className={styles.hero}>
      <div className={styles.copy}>
        <Heading level={1}>{hero.title}</Heading>
        <Text size="xl" className={styles.text}>
          {hero.text}
        </Text>
        <div className={styles.actions}>
          <ButtonLink href={links.signUp}>{signUpLabel}</ButtonLink>
          <ButtonLink href="#como" variant="outline">
            {hero.secondary}
          </ButtonLink>
        </div>
        <Fine>{hero.fine}</Fine>
      </div>
      <div className={styles.visual}>
        <Photo name="abraco" priority className={styles.photo} />
        <NoteCard icon={<PhoneIcon />} label={hero.before.label} className={styles.before}>
          {hero.before.text}
        </NoteCard>
        <NoteCard icon={<PhoneIcon />} label={hero.now.label} className={styles.now}>
          {hero.now.text}
          <span className={styles.check}>
            <CheckIcon />
            {hero.now.check}
          </span>
        </NoteCard>
      </div>
    </Container>
  );
}
