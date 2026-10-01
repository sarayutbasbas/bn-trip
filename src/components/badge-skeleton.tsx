function Block({ className = "" }: { className?: string }) {
  return <span className={`route-skeleton-block ${className}`} />;
}

function BadgeHeading({ seeAll = false }: { seeAll?: boolean }) {
  return <div className="badge-skeleton-heading">
    <Block className="badge-skeleton-heading-icon" />
    <div><Block className="route-skeleton-line is-title" /><Block className="route-skeleton-line" /></div>
    {seeAll ? <Block className="badge-skeleton-link" /> : null}
  </div>;
}

export function BadgeHighlightSkeleton() {
  return <div className="badge-highlight-skeleton" role="status" aria-label="กำลังโหลดเข็มกลัด" aria-busy="true">
    <BadgeHeading seeAll />
    <Block className="badge-skeleton-progress" />
    <div className="badge-skeleton-highlight badge-skeleton-recent">
      <div><Block className="route-skeleton-line is-short" /><Block className="route-skeleton-line is-title" /><Block className="route-skeleton-line" /></div>
      {[0, 1, 2, 3].map(index => <Block key={index} className="badge-skeleton-art" />)}
    </div>
  </div>;
}

export function BadgesRouteLoading() {
  return <div className="app-shell flow-shell badges-page-shell badges-detail-page" role="status" aria-label="กำลังโหลดเข็มกลัดทั้งหมด" aria-busy="true">
    <main aria-hidden="true">
      <div className="badges-back-bar"><Block className="badge-skeleton-back" /></div>
      <div className="badges-screen badges-screen-redesign">
        <BadgeHeading />
        <div className="badge-skeleton-filters">{[0, 1, 2, 3].map(index => <div key={index}>
          <Block className="badge-skeleton-filter-icon" /><Block className="route-skeleton-line" /><Block className="route-skeleton-line is-short" />
        </div>)}</div>
        <div className="badge-skeleton-collection-heading"><Block className="route-skeleton-section-title" /><Block className="badge-skeleton-link" /></div>
        <div className="badge-collection-grid">{Array.from({ length: 16 }, (_, index) => <div className="badge-skeleton-card" key={index}>
          <Block className="badge-skeleton-card-art" /><Block className="route-skeleton-line is-title" /><Block className="route-skeleton-line" /><Block className="route-skeleton-line is-short" />
        </div>)}</div>
      </div>
    </main>
  </div>;
}
