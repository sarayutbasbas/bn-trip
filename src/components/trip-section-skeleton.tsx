type TripSectionSkeletonVariant =
  | "accommodations"
  | "flights"
  | "insurance"
  | "checklist"
  | "documents";

function Block({ className = "" }: { className?: string }) {
  return <span className={`route-skeleton-block ${className}`.trim()} />;
}

function RowCard({ withThumb = true }: { withThumb?: boolean }) {
  return (
    <div className="trip-section-skeleton-card">
      {withThumb ? <Block className="trip-section-skeleton-thumb" /> : null}
      <div className="trip-section-skeleton-copy">
        <Block className="trip-section-skeleton-line is-title" />
        <Block className="trip-section-skeleton-line is-medium" />
        <Block className="trip-section-skeleton-line is-short" />
      </div>
      <Block className="trip-section-skeleton-action" />
    </div>
  );
}

export function TripSectionSkeleton({
  variant,
}: {
  variant: TripSectionSkeletonVariant;
}) {
  if (variant === "flights") {
    return (
      <div className="trip-section-skeleton is-flights" role="status" aria-label="กำลังโหลดข้อมูล" aria-busy="true">
        <div aria-hidden="true">
          {[0, 1].map((index) => (
            <div className="trip-section-skeleton-flight" key={index}>
              <div className="trip-section-skeleton-flight-head">
                <Block className="trip-section-skeleton-avatar" />
                <div className="trip-section-skeleton-copy">
                  <Block className="trip-section-skeleton-line is-medium" />
                  <Block className="trip-section-skeleton-line is-title" />
                </div>
                <Block className="trip-section-skeleton-pill" />
              </div>
              <div className="trip-section-skeleton-route">
                <Block /><Block /><Block />
              </div>
              <Block className="trip-section-skeleton-flight-footer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "insurance") {
    return (
      <div className="trip-section-skeleton is-insurance" role="status" aria-label="กำลังโหลดข้อมูล" aria-busy="true">
        <div aria-hidden="true">
          <div className="trip-section-skeleton-summary">
            <Block className="trip-section-skeleton-avatar" />
            <div className="trip-section-skeleton-copy">
              <Block className="trip-section-skeleton-line is-title" />
              <Block className="trip-section-skeleton-line is-medium" />
            </div>
            <Block className="trip-section-skeleton-score" />
          </div>
          {[0, 1, 2].map((index) => <RowCard key={index} />)}
        </div>
      </div>
    );
  }

  if (variant === "checklist" || variant === "documents") {
    return (
      <div className={`trip-section-skeleton is-${variant}`} role="status" aria-label="กำลังโหลดข้อมูล" aria-busy="true">
        <div aria-hidden="true">
          {variant === "documents" ? <Block className="trip-section-skeleton-quota" /> : null}
          <Block className="trip-section-skeleton-toolbar" />
          {[0, 1, 2].map((index) => <RowCard key={index} withThumb />)}
        </div>
      </div>
    );
  }

  return (
    <div className="trip-section-skeleton is-accommodations" role="status" aria-label="กำลังโหลดข้อมูล" aria-busy="true">
      <div aria-hidden="true">
        {[0, 1].map((index) => <RowCard key={index} />)}
      </div>
    </div>
  );
}
