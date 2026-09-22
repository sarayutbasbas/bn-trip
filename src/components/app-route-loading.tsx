export function AppRouteLoading() {
  return (
    <div className="app-shell flow-shell route-skeleton-shell" role="status" aria-label="กำลังเปิดหน้า">
      <main>
        <div className="route-skeleton-top">
          <span className="route-skeleton-block route-skeleton-logo" />
          <span className="route-skeleton-block route-skeleton-avatar" />
        </div>
        <section className="route-skeleton-content" aria-hidden="true">
          <span className="route-skeleton-block route-skeleton-kicker" />
          <span className="route-skeleton-block route-skeleton-title" />
          <span className="route-skeleton-block route-skeleton-hero" />
          <div className="route-skeleton-actions">
            <span className="route-skeleton-block" />
            <span className="route-skeleton-block" />
            <span className="route-skeleton-block" />
          </div>
          <span className="route-skeleton-block route-skeleton-heading" />
          <div className="route-skeleton-cards">
            <span className="route-skeleton-block" />
            <span className="route-skeleton-block" />
          </div>
        </section>
        <span className="sr-only">กำลังโหลดข้อมูล…</span>
      </main>
    </div>
  );
}
