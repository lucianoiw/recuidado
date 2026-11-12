import { footer } from "@/content/site";
import { links } from "@/lib/links";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <Container as="footer" className={styles.footer}>
      <div className={styles.inner}>
        <Logo width={140} />
        <p className={styles.text}>
          <span className={styles.line}>{footer.text}</span>
          <span className={styles.line}>
            {footer.character} <a href={links.privacy}>{footer.privacy}</a> · <a href={links.privacyEmail}>{footer.email}</a>
          </span>
        </p>
      </div>
    </Container>
  );
}
