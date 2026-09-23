import type { ReactNode } from "react";

export function TripSectionHeading({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`trip-section-heading ${className}`.trim()}>
      <div className="trip-section-heading-copy">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actions ? (
        <div className="trip-section-heading-actions">{actions}</div>
      ) : null}
    </header>
  );
}
