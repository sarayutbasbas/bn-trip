import type { ReactNode } from "react";
import { Plus } from "lucide-react";

export function TripSectionEmpty({
  icon,
  title,
  description,
  action,
  onClick,
  className = "",
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <article className={`card empty-state trip-section-empty ${className}`.trim()}>
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <button type="button" className="primary-btn" onClick={onClick}>
        <Plus size={16} />
        {action}
      </button>
    </article>
  );
}
