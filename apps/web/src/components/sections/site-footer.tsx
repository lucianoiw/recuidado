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
        <span className={styles.text}>
          {footer.text} <a href={links.privacy}>{footer.privacy}</a> · <a href={links.privacyEmail}>{footer.email}</a>
        </span>
      </div>
    </Container>
  );
}
