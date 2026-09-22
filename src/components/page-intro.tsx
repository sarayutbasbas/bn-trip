import type { ReactNode } from "react";

export function PageIntro({
  title,
  subtitle,
  titleIcon,
  subtitleIcon,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  titleIcon?: ReactNode;
  subtitleIcon?: ReactNode;
}) {
  return (
    <section className="page-intro">
      <div className="page-intro-copy">
        <h1>
          <span>{title}</span>
          {titleIcon}
        </h1>
        <p>
          <span>{subtitle}</span>
          {subtitleIcon}
        </p>
      </div>
      <span className="page-intro-note" aria-hidden="true">Good trips<br />happier us ♡</span>
    </section>
  );
}
