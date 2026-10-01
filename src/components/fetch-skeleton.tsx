export function FetchSkeleton({ rows = 3, label = "กำลังโหลดข้อมูล" }: { rows?: number; label?: string }) {
  return <div className="fetch-skeleton" role="status" aria-label={label} aria-busy="true">
    {Array.from({ length: rows }, (_, index) => <div className="trip-section-skeleton-card" key={index} aria-hidden="true">
      <span className="route-skeleton-block trip-section-skeleton-thumb" />
      <div className="trip-section-skeleton-copy">
        <span className="route-skeleton-block trip-section-skeleton-line is-title" />
        <span className="route-skeleton-block trip-section-skeleton-line is-medium" />
        <span className="route-skeleton-block trip-section-skeleton-line is-short" />
      </div>
    </div>)}
  </div>;
}
