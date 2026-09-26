import Image from "next/image";
import Link from "next/link";

type LoadingPage = "home" | "trips" | "ideas" | "analytics" | "settings";

function Block({ className = "" }: { className?: string }) {
  return <span className={`route-skeleton-block ${className}`.trim()} />;
}

function Intro({ page }: { page: LoadingPage }) {
  return <div className={`route-skeleton-intro is-${page}`}>
    <div className="route-skeleton-intro-title-row"><Block className="route-skeleton-intro-title" />{page === "ideas" && <Block className="route-skeleton-intro-icon" />}</div>
    <Block className="route-skeleton-intro-subtitle" />
  </div>;
}

function CardRows({ count = 3 }: { count?: number }) {
  return <div className="route-skeleton-card-list">
    {Array.from({ length: count }, (_, index) => <div className="route-skeleton-list-card" key={index}>
      <Block className="route-skeleton-card-cover" />
      <div className="route-skeleton-card-copy">
        <Block className="route-skeleton-line is-title" />
        <Block className="route-skeleton-line" />
        <Block className="route-skeleton-line is-short" />
      </div>
    </div>)}
  </div>;
}

function SearchRow({ buttons }: { buttons: number }) {
  return <div className="route-skeleton-search-row">
    <Block className="route-skeleton-search" />
    {Array.from({ length: buttons }, (_, index) => <Block className="route-skeleton-search-action" key={index} />)}
  </div>;
}

function HomeLoading() {
  return <div className="route-skeleton-screen route-skeleton-home">
    <Intro page="home" />
    <Block className="route-skeleton-featured" />
    <div className="route-skeleton-quick-actions">{[0, 1, 2].map(index => <Block key={index} />)}</div>
    <Block className="route-skeleton-section-title" />
    <div className="route-skeleton-home-cards">{[0, 1].map(index => <Block key={index} />)}</div>
    <Block className="route-skeleton-progress" />
  </div>;
}

function TripsLoading() {
  return <div className="route-skeleton-screen route-skeleton-trips">
    <Intro page="trips" />
    <SearchRow buttons={2} />
    <div className="route-skeleton-filters">{[0, 1, 2].map(index => <Block key={index} />)}</div>
    <CardRows count={4} />
  </div>;
}

function IdeasLoading() {
  return <div className="route-skeleton-screen route-skeleton-ideas">
    <Intro page="ideas" />
    <SearchRow buttons={2} />
    <div className="route-skeleton-filters">{[0, 1, 2].map(index => <Block key={index} />)}</div>
    <div className="route-skeleton-idea-cards">{[0, 1, 2, 3].map(index => <div className="route-skeleton-list-card" key={index}>
      <Block className="route-skeleton-card-cover" />
      <div className="route-skeleton-card-copy">
        <Block className="route-skeleton-line is-title" />
        <Block className="route-skeleton-line" />
        <Block className="route-skeleton-line is-short" />
      </div>
    </div>)}</div>
  </div>;
}

function AnalyticsLoading() {
  return <div className="route-skeleton-screen route-skeleton-analytics">
    <Intro page="analytics" />
    <div className="route-skeleton-filters">{[0, 1, 2].map(index => <Block key={index} />)}</div>
    <div className="route-skeleton-kpis">{[0, 1, 2, 3].map(index => <div className="route-skeleton-kpi" key={index}>
      <Block className="route-skeleton-kpi-icon" />
      <div><Block className="route-skeleton-line is-title" /><Block className="route-skeleton-line" /></div>
    </div>)}</div>
    <div className="route-skeleton-map"><Block className="route-skeleton-section-title" /><Block className="route-skeleton-map-art" /></div>
    <div className="route-skeleton-analytics-cards">{[0, 1].map(index => <Block key={index} />)}</div>
  </div>;
}

function SettingsLoading() {
  return <div className="route-skeleton-screen route-skeleton-settings">
    <Intro page="settings" />
    <div className="route-skeleton-account">
      <Block className="route-skeleton-account-avatar" />
      <div><Block className="route-skeleton-line is-title" /><Block className="route-skeleton-line" /></div>
    </div>
    <div className="route-skeleton-settings-list">{[0, 1, 2, 3].map(index => <div className="route-skeleton-setting-card" key={index}>
      <Block className="route-skeleton-setting-icon" />
      <div><Block className="route-skeleton-line is-title" /><Block className="route-skeleton-line" /></div>
      <Block className="route-skeleton-setting-action" />
    </div>)}</div>
  </div>;
}

export function AppRouteLoading({ page = "home" }: { page?: LoadingPage }) {
  const shellClass = page === "ideas" ? "trip-ideas-page-shell" : page === "home" ? "dashboard-page-shell main-nav-page-shell" : "main-nav-page-shell";
  return <div className={`app-shell flow-shell ${shellClass} route-skeleton-shell route-skeleton-${page}`} role="status" aria-label="กำลังเปิดหน้า">
    <main>
      <header className="mobile-head flow-header route-skeleton-header">
        <Link className="brand" href="/" aria-label="RouteRao · หน้าแรก">
          <Image src="/routerao-logo-transparent-512.png" alt="RouteRao" width={48} height={48} priority unoptimized />
          <div>RouteRao<small>travel smarter together</small></div>
        </Link>
        <div className="mobile-actions route-skeleton-header-actions" aria-hidden="true">
          {page !== "settings" && <Block className="route-skeleton-header-icon" />}
          <Block className="route-skeleton-header-icon is-notification" />
          <Block className="route-skeleton-header-avatar" />
        </div>
      </header>
      {page === "home" ? <HomeLoading /> : page === "trips" ? <TripsLoading /> : page === "ideas" ? <IdeasLoading /> : page === "analytics" ? <AnalyticsLoading /> : <SettingsLoading />}
      <span className="sr-only">กำลังโหลดข้อมูล…</span>
    </main>
  </div>;
}
