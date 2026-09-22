"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { House, Images, Navigation, UserRound } from "lucide-react";
import { LiquidGlass, type RenderingDiagnostics } from "simple-liquid-glass";

const NAV_VISIBLE_PATHS = new Set([
  "/",
  "/trips",
  "/album",
  "/settings",
  "/analytics",
  "/badges",
  "/trip-ideas",
]);

/** Preserved WebGL nav variant. The active app nav uses the CodePen SVG filter version. */
export function LiquidAppBottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const navWrapRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const positionedRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const activeIndexRef = useRef(0);
  const pointerAbortRef = useRef<AbortController | null>(null);
  const dragRef = useRef({
    pointerId: null as number | null,
    pressX: 0,
    pressY: 0,
    pressWidth: 0,
    targetIndex: 0,
    dragging: false,
  });
  const items = useMemo(() => [
    { label: "หน้าแรก", href: "/", icon: House, active: pathname === "/" },
    { label: "ทริป", href: "/trips", icon: Navigation, active: pathname === "/trips" || pathname.startsWith("/trips/") || pathname.startsWith("/trip-ideas") },
    { label: "ความทรงจำ", href: "/album", icon: Images, active: pathname === "/album" },
    { label: "ฉัน", href: "/settings", icon: UserRound, active: pathname.startsWith("/settings") || pathname === "/analytics" || pathname === "/badges" },
  ], [pathname]);
  const activeIndex = Math.max(0, items.findIndex((item) => item.active));
  const [pendingNavigation, setPendingNavigation] = useState<{ index: number; href: string; sourcePath: string } | null>(null);
  const visualIndex = pendingNavigation && pendingNavigation.sourcePath === pathname && pendingNavigation.href !== pathname
    ? pendingNavigation.index
    : activeIndex;

  const handleGlassDiagnostics = useCallback((diagnostics: RenderingDiagnostics) => {
    const nav = navWrapRef.current;
    if (!nav) return;
    nav.dataset.glassStrategy = diagnostics.strategy;
    nav.dataset.glassReason = diagnostics.reason;
  }, []);

  useEffect(() => {
    const prefetchPrimaryRoutes = () => {
      ["/", "/trips", "/album", "/settings"].forEach((href) => {
        if (href !== pathname) router.prefetch(href);
      });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(prefetchPrimaryRoutes, { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const timer = setTimeout(prefetchPrimaryRoutes, 180);
    return () => clearTimeout(timer);
  }, [pathname, router]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const positionIndicator = useCallback((index: number, animate: boolean) => {
    const indicator = indicatorRef.current;
    const item = itemRefs.current[index];
    const nav = navRef.current;
    if (!indicator || !item || !nav) return;
    if (!animate) indicator.style.transition = "none";
    else {
      const currentLeft = Number.parseFloat(getComputedStyle(indicator).left) || indicator.offsetLeft;
      const distanceInTabs = Math.abs(item.offsetLeft - currentLeft) / Math.max(1, item.offsetWidth);
      const duration = Math.round(Math.min(600, 300 + distanceInTabs * 95));
      indicator.style.setProperty("--nav-slide-duration", `${duration}ms`);
      indicator.style.removeProperty("transition");
    }
    indicator.style.left = `${item.offsetLeft}px`;
    indicator.style.width = `${item.offsetWidth}px`;
    if (!animate) {
      void indicator.offsetWidth;
      indicator.style.removeProperty("transition");
    }
  }, []);

  const markTarget = useCallback((targetIndex: number) => {
    itemRefs.current.forEach((item, index) => item?.classList.toggle("is-pass-target", index === targetIndex));
  }, []);

  const itemMetrics = useCallback((index: number) => {
    const nav = navRef.current;
    const item = itemRefs.current[index];
    if (!nav || !item) return null;
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const scaleX = navRect.width > 0 ? nav.clientWidth / navRect.width : 1;
    const left = (itemRect.left - navRect.left) * scaleX;
    const width = itemRect.width * scaleX;
    return { left, width, center: left + width / 2 };
  }, []);

  const toLocalX = useCallback((clientX: number) => {
    const nav = navRef.current;
    if (!nav) return 0;
    const rect = nav.getBoundingClientRect();
    const scaleX = rect.width > 0 ? nav.clientWidth / rect.width : 1;
    return (clientX - rect.left) * scaleX;
  }, []);

  const nearestIndex = useCallback((localX: number) => {
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    itemRefs.current.forEach((_, index) => {
      const metrics = itemMetrics(index);
      if (!metrics) return;
      const distance = Math.abs(localX - metrics.center);
      if (distance < closestDistance) {
        closest = index;
        closestDistance = distance;
      }
    });
    return closest;
  }, [itemMetrics]);

  const setGlow = useCallback((clientX: number, clientY: number, alpha: number) => {
    const nav = navRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    nav.style.setProperty("--gx", `${toLocalX(clientX)}px`);
    nav.style.setProperty("--gy", `${clientY - rect.top}px`);
    nav.style.setProperty("--ga", String(alpha));
  }, [toLocalX]);

  const clearInteraction = useCallback(() => {
    itemRefs.current.forEach((item) => item?.classList.remove("is-pass-target"));
    navWrapRef.current?.classList.remove("engaged");
    navRef.current?.classList.remove("dragging");
    indicatorRef.current?.classList.remove("interacting");
    navRef.current?.style.setProperty("--ga", "0");
  }, []);

  const finishNavigation = useCallback((index: number, href: string) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    navWrapRef.current?.classList.add("engaged");
    setPendingNavigation({ index, href, sourcePath: pathname });
    positionIndicator(index, true);
    markTarget(index);
    if (href !== pathname) {
      document.documentElement.classList.add("app-route-pending");
      router.push(href);
      return;
    }
    settleTimer.current = setTimeout(() => {
      setPendingNavigation(null);
      clearInteraction();
    }, 180);
  }, [clearInteraction, markTarget, pathname, positionIndicator, router]);

  const endPointerInteraction = useCallback((navigate: boolean) => {
    const state = dragRef.current;
    const selectedIndex = state.targetIndex;
    const selected = items[selectedIndex];
    state.pointerId = null;
    state.dragging = false;
    navRef.current?.classList.remove("dragging");
    indicatorRef.current?.classList.remove("interacting");

    if (navigate && selected) {
      suppressClickRef.current = true;
      if (suppressClickTimer.current) clearTimeout(suppressClickTimer.current);
      suppressClickTimer.current = setTimeout(() => { suppressClickRef.current = false; }, 120);
      finishNavigation(selectedIndex, selected.href);
      return;
    }

    positionIndicator(activeIndexRef.current, true);
    setPendingNavigation(null);
    clearInteraction();
  }, [clearInteraction, finishNavigation, items, positionIndicator]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const state = dragRef.current;
    if (event.pointerId !== state.pointerId) return;
    const deltaX = Math.abs(event.clientX - state.pressX);
    const deltaY = Math.abs(event.clientY - state.pressY);
    if (!state.dragging && (deltaX > 6 || deltaY > 6)) {
      state.dragging = true;
      navRef.current?.classList.add("dragging");
    }
    if (!state.dragging) {
      setGlow(event.clientX, event.clientY, 0.22);
      return;
    }

    event.preventDefault();
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const localX = toLocalX(event.clientX);
    const width = state.pressWidth || itemMetrics(activeIndexRef.current)?.width || 0;
    const shouldExpand = deltaX >= Math.max(22, width * 0.28);
    indicator.classList.toggle("interacting", shouldExpand);
    const left = Math.min(nav.clientWidth - width, Math.max(0, localX - width / 2));
    indicator.style.left = `${left}px`;
    indicator.style.width = `${width}px`;
    state.targetIndex = nearestIndex(localX);
    markTarget(shouldExpand ? state.targetIndex : -1);
    setGlow(event.clientX, event.clientY, 0.18);
  }, [itemMetrics, markTarget, nearestIndex, setGlow, toLocalX]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (event.pointerId !== dragRef.current.pointerId) return;
    pointerAbortRef.current?.abort();
    pointerAbortRef.current = null;
    endPointerInteraction(true);
  }, [endPointerInteraction]);

  const handlePointerCancel = useCallback((event: PointerEvent) => {
    if (event.pointerId !== dragRef.current.pointerId) return;
    pointerAbortRef.current?.abort();
    pointerAbortRef.current = null;
    endPointerInteraction(false);
  }, [endPointerInteraction]);

  const handlePointerDown = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || dragRef.current.pointerId !== null) return;
    event.preventDefault();
    const metrics = itemMetrics(index);
    dragRef.current = {
      pointerId: event.pointerId,
      pressX: event.clientX,
      pressY: event.clientY,
      pressWidth: metrics?.width || 0,
      targetIndex: index,
      dragging: false,
    };
    if (settleTimer.current) clearTimeout(settleTimer.current);
    navWrapRef.current?.classList.add("engaged");
    indicatorRef.current?.classList.remove("interacting");
    markTarget(-1);
    setGlow(event.clientX, event.clientY, 0.24);
    pointerAbortRef.current?.abort();
    const pointerAbort = new AbortController();
    pointerAbortRef.current = pointerAbort;
    window.addEventListener("pointermove", handlePointerMove, { passive: false, signal: pointerAbort.signal });
    window.addEventListener("pointerup", handlePointerUp, { signal: pointerAbort.signal });
    window.addEventListener("pointercancel", handlePointerCancel, { signal: pointerAbort.signal });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      positionIndicator(visualIndex, positionedRef.current);
      positionedRef.current = true;
    });
    const handleResize = () => positionIndicator(visualIndex, false);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [positionIndicator, visualIndex]);

  useLayoutEffect(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    document.documentElement.classList.remove("app-route-pending");
    clearInteraction();
  }, [clearInteraction, pathname]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (suppressClickTimer.current) clearTimeout(suppressClickTimer.current);
    pointerAbortRef.current?.abort();
    pointerAbortRef.current = null;
    clearInteraction();
  }, [clearInteraction]);

  const hidden = !NAV_VISIBLE_PATHS.has(pathname);
  if (hidden) return null;

  return (
    <nav ref={navWrapRef} className="app-bottom-navigation ios26-nav" aria-label="เมนูหลัก">
      <LiquidGlass
        className="app-bottom-navigation-surface"
        renderer="webgl"
        material="clear"
        refraction="lens"
        lensProfile="loupe"
        lensOptions={{
          strength: 0.09,
          depth: 0.72,
          curvature: 0.42,
          bend: 0.34,
          bendWidth: 0.09,
          sheen: 0.48,
          sheenWidth: 3.5,
          specular: 1.05,
          glow: 0.07,
          brightness: 0.02,
        }}
        radius={38}
        displacementScale={24}
        blur={1}
        frost={0.015}
        saturation={108}
        dispersion={22}
        aberrationIntensity={0.12}
        glassColor="rgba(255,255,255,0.05)"
        borderColor="rgba(255,255,255,0.34)"
        quality="standard"
        track
        onDiagnosticsChange={handleGlassDiagnostics}
      >
        <div ref={navRef} className="app-bottom-navigation-inner ios26-nav-inner">
          <span className="app-bottom-navigation-glow" aria-hidden="true" />
          <span ref={indicatorRef} className="app-bottom-navigation-indicator tab-indicator" aria-hidden="true">
            <LiquidGlass
              className="app-bottom-navigation-indicator-glass"
              renderer="webgl"
              material="clear"
              refraction="lens"
              lensProfile="loupe"
              lensOptions={{
                strength: 0.11,
                depth: 0.82,
                curvature: 0.44,
                bend: 0.34,
                bendWidth: 0.07,
                sheen: 0.8,
                sheenWidth: 3.5,
                specular: 1.2,
                glow: 0.07,
              }}
              radius={30}
              displacementScale={28}
              blur={1}
              frost={0.015}
              saturation={108}
              dispersion={24}
              aberrationIntensity={0.14}
              glassColor="rgba(255,255,255,0.05)"
              borderColor="rgba(255,255,255,0.36)"
              quality="standard"
              track
            >
              <span className="app-bottom-navigation-indicator-fill" />
            </LiquidGlass>
          </span>
          {items.map(({ label, href, icon: Icon, active }, index) => {
            const visuallyActive = index === visualIndex;
            return (
              <button
                key={href}
                type="button"
                className={`app-bottom-navigation-item${visuallyActive ? " is-active" : ""}`}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                ref={(node) => { itemRefs.current[index] = node; }}
                onPointerDown={(event) => handlePointerDown(index, event)}
                onClick={(event) => {
                  if (suppressClickRef.current && event.detail > 0) return;
                  finishNavigation(index, href);
                }}
                onContextMenu={(event) => event.preventDefault()}
              >
                <span className="app-bottom-navigation-content" aria-hidden="true">
                  <Icon className="ios-icon" size={24} strokeWidth={visuallyActive ? 2.35 : 2} />
                  <span className="app-bottom-navigation-label">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </LiquidGlass>
    </nav>
  );
}
