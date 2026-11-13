import Link from "next/link";
import { banner, nav, signUpLabel } from "@/content/site";
import { links } from "@/lib/links";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <>
      <div className={styles.banner}>
        <b>{banner.title}</b> {banner.text}
      </div>
      <Container as="header" className={styles.header}>
        <Link href="/" aria-label="Recuidado" className={styles.home}>
          <Logo className={styles.logo} />
        </Link>
        <nav className={styles.nav}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={`${styles.link} ${styles.section}`}>
              {item.label}
            </Link>
          ))}
          <a href={links.signIn} className={styles.link}>
            Entrar
          </a>
          <a href={links.signUp} className={styles.cta}>
            {signUpLabel}
          </a>
        </nav>
      </Container>
    </>
  );
}
