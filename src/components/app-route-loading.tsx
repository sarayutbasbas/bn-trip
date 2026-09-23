import Image from "next/image";
import Link from "next/link";

export function AppRouteLoading() {
  return (
    <div className="app-shell flow-shell route-skeleton-shell" role="status" aria-label="กำลังเปิดหน้า">
      <main>
        <header className="mobile-head flow-header route-skeleton-header">
          <Link className="brand" href="/" aria-label="RouteRao · หน้าแรก">
            <Image src="/routerao-logo-transparent-512.png" alt="RouteRao" width={48} height={48} priority unoptimized />
            <div>RouteRao<small>travel smarter together</small></div>
          </Link>
          <div className="route-skeleton-header-actions" aria-hidden="true">
            <span className="route-skeleton-block" />
            <span className="route-skeleton-block" />
            <span className="route-skeleton-block" />
          </div>
        </header>
        <section className="route-skeleton-content" aria-hidden="true">
          <span className="route-skeleton-block route-skeleton-kicker" />
          <span className="route-skeleton-block route-skeleton-title" />
          <span className="route-skeleton-block route-skeleton-search" />
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
            <span className="route-skeleton-block" />
            <span className="route-skeleton-block" />
          </div>
        </section>
        <span className="sr-only">กำลังโหลดข้อมูล…</span>
      </main>
    </div>
  );
}
