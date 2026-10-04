function Block({ className = "" }: { className?: string }) {
  return <span className={`route-skeleton-block ${className}`} />;
}

/** Shared by route transitions and the client-side trip loading state. */
export function TimelineSkeleton() {
  return <div className="screen trip-hub-screen timeline-skeleton" role="status" aria-label="กำลังเปิดไทม์ไลน์" aria-busy="true">
    <div aria-hidden="true">
      <div className="trip-cover-region">
        <div className="trip-detail-head has-cover">
          <div className="trip-detail-image-frame route-skeleton-block" />
          <div className="timeline-skeleton-cover-controls"><Block className="is-circle" /><div>{[0, 1, 2].map(i => <Block key={i} className="is-circle" />)}</div></div>
          <div className="timeline-skeleton-cover-copy"><Block className="is-badge" /><Block className="is-title" /><Block className="is-location" /><Block className="is-date" /></div>
          <div className="timeline-skeleton-members">{[0, 1].map(i => <Block key={i} className="is-circle" />)}</div>
        </div>
      </div>
      <div className="trip-section-nav has-5-items timeline-skeleton-nav">{[0, 1, 2, 3, 4].map(i => <div key={i}><Block className="is-icon" /><Block className="is-label" /></div>)}</div>
      <div className="timeline-skeleton-heading"><div><Block className="is-title" /><Block className="is-date" /></div><Block className="is-circle" /><Block className="is-circle" /></div>
      <div className="timeline-skeleton-days">{[0, 1, 2, 3, 4].map(i => <Block key={i} className="is-circle" />)}</div>
      <div className="timeline-skeleton-items">{[0, 1, 2].map(i => <div className="timeline-skeleton-stop" key={i}>
        <Block className="timeline-skeleton-node is-circle" />
        <div className="timeline-skeleton-card"><Block className="timeline-skeleton-photo" /><div className="timeline-skeleton-copy"><Block className="is-title" /><Block className="is-location" /><Block className="is-date" /><div className="timeline-skeleton-tags"><Block /><Block /></div></div><div className="timeline-skeleton-actions"><Block className="is-circle" /><Block className="is-circle" /></div></div>
        <Block className="timeline-skeleton-transport" />
      </div>)}</div>
    </div>
    <span className="sr-only">กำลังโหลดข้อมูลทริปและแผนการเดินทาง…</span>
  </div>;
}

export function TimelineRouteLoading() {
  return <div className="app-shell flow-shell trip-page-shell"><main><TimelineSkeleton /></main></div>;
}
