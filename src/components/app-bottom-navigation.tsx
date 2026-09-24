"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SVGProps,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  attachCodepenNavGlass,
  attachCodepenSwitcherGlass,
} from "@/src/lib/codepen-switcher-glass";

const NAV_VISIBLE_PATHS = new Set([
  "/", "/trips", "/settings", "/analytics", "/badges", "/trip-ideas",
]);

type NavIconName = "home" | "trip" | "wishlist" | "stats" | "profile";

function NavIcon({ name, filled, ...props }: SVGProps<SVGSVGElement> & {
  name: NavIconName;
  filled: boolean;
}) {
  const common = { vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {name === "home" ? filled ? (
        <path fill="currentColor" stroke="none" d="M2.8 10.4 12 2.9l9.2 7.5v9.1a1.6 1.6 0 0 1-1.6 1.6h-5.1v-6.4h-5v6.4H4.4a1.6 1.6 0 0 1-1.6-1.6z" />
      ) : (
        <path {...common} d="m3 10.5 9-7.3 9 7.3v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6.3h-5V21h-5A1.5 1.5 0 0 1 3 19.5z" />
      ) : null}
      {name === "trip" ? (
        filled ? (
          <path fill="currentColor" stroke="none" d="m2.5 4.8 6-2.3 7 2.8 6-2.3v16.2l-6 2.3-7-2.8-6 2.3zm6 0v11.8l7 2.8V7.5z" />
        ) : (
          <>
            <path {...common} d="m2.5 4.8 6-2.3 7 2.8 6-2.3v16.2l-6 2.3-7-2.8-6 2.3z" />
            <path {...common} d="M8.5 2.5v16.2M15.5 5.3v16.2" />
          </>
        )
      ) : null}
      {name === "wishlist" ? filled ? (
        <path fill="currentColor" stroke="none" d="M12 21.2 10.55 19.9C5.4 15.28 2 12.2 2 8.42 2 5.34 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6.02 6.02 0 0 1 16.5 3C19.58 3 22 5.34 22 8.42c0 3.78-3.4 6.86-8.55 11.49z" />
      ) : (
        <path {...common} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
      ) : null}
      {name === "stats" ? filled ? (
        <>
          <rect x="3" y="13" width="4.5" height="8" rx="1.4" fill="currentColor" stroke="none" />
          <rect x="9.75" y="8" width="4.5" height="13" rx="1.4" fill="currentColor" stroke="none" />
          <rect x="16.5" y="3" width="4.5" height="18" rx="1.4" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect {...common} x="3" y="13" width="4.5" height="8" rx="1.4" />
          <rect {...common} x="9.75" y="8" width="4.5" height="13" rx="1.4" />
          <rect {...common} x="16.5" y="3" width="4.5" height="18" rx="1.4" />
        </>
      ) : null}
      {name === "profile" ? filled ? (
        <>
          <circle cx="12" cy="7.6" r="4" fill="currentColor" stroke="none" />
          <path fill="currentColor" stroke="none" d="M4.2 21a7.8 7.8 0 0 1 15.6 0z" />
        </>
      ) : (
        <>
          <circle {...common} cx="12" cy="7.5" r="3.8" />
          <path {...common} d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      ) : null}
    </svg>
  );
}

export function AppBottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const navWrapRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const navGlassRef = useRef<ReturnType<typeof attachCodepenNavGlass> | null>(null);
  const indicatorGlassRef = useRef<ReturnType<typeof attachCodepenSwitcherGlass> | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndexRef = useRef(0);
  const positionedRef = useRef(false);
  const navWasVisibleRef = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passingAnimationRef = useRef<number | null>(null);
  const themeRebuildFrameRef = useRef<number | null>(null);
  const usePassingBlurRef = useRef(false);
  const suppressClickRef = useRef(false);
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
    { label: "หน้าแรก", href: "/", icon: "home" as const, active: pathname === "/" },
    { label: "ทริป", href: "/trips", icon: "trip" as const, active: pathname === "/trips" },
    { label: "เล็งไว้", href: "/trip-ideas", icon: "wishlist" as const, active: pathname === "/trip-ideas" },
    { label: "สถิติ", href: "/analytics", icon: "stats" as const, active: pathname === "/analytics" || pathname === "/badges" },
    { label: "ฉัน", href: "/settings", icon: "profile" as const, active: pathname.startsWith("/settings") },
  ], [pathname]);
  const activeIndex = Math.max(0, items.findIndex((item) => item.active));
  const navVisible = NAV_VISIBLE_PATHS.has(pathname);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const visualIndex = pendingIndex ?? activeIndex;

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

  const positionIndicator = useCallback((index: number, animate: boolean) => {
    const indicator = indicatorRef.current;
    const metrics = itemMetrics(index);
    if (!indicator || !metrics) return 0;
    const currentLeft = Number.parseFloat(indicator.style.left) || indicator.offsetLeft;
    const distance = Math.abs(metrics.left - currentLeft) / Math.max(1, metrics.width);
    const duration = Math.round(Math.min(780, 330 + distance * 125));
    indicator.style.setProperty("--nav-slide-duration", `${duration}ms`);
    if (!animate) indicator.style.transition = "none";
    else indicator.style.removeProperty("transition");
    indicator.style.left = `${metrics.left}px`;
    indicator.style.width = `${metrics.width}px`;
    if (!animate) {
      void indicator.offsetWidth;
      indicator.style.removeProperty("transition");
    }
    return duration;
  }, [itemMetrics]);

  const paintPassingItems = useCallback((targetIndex: number) => {
    const indicator = indicatorRef.current;
    if (!indicator) return;
    const lens = indicator.getBoundingClientRect();
    const measurements = itemRefs.current.map((item) => (
      item ? { item, rect: item.getBoundingClientRect() } : null
    ));
    measurements.forEach((measurement, index) => {
      if (!measurement) return;
      const { item, rect } = measurement;
      const overlap = Math.max(0, Math.min(lens.right, rect.right) - Math.max(lens.left, rect.left));
      const ratio = Math.min(1, overlap / Math.max(1, rect.width));
      const passing = index === targetIndex ? 0 : ratio;
      item.style.filter = usePassingBlurRef.current && passing > 0.02
        ? `blur(${(passing * 1.6).toFixed(2)}px)`
        : "";
      item.style.opacity = passing > 0.02 ? String(1 - passing * 0.3) : "";
      item.classList.toggle("is-pass-target", index === targetIndex);
    });
  }, []);

  const animatePassingItems = useCallback((targetIndex: number, duration: number) => {
    if (passingAnimationRef.current !== null) cancelAnimationFrame(passingAnimationRef.current);
    const started = performance.now();
    const frame = (now: number) => {
      paintPassingItems(targetIndex);
      if (now - started < duration) passingAnimationRef.current = requestAnimationFrame(frame);
      else passingAnimationRef.current = null;
    };
    passingAnimationRef.current = requestAnimationFrame(frame);
  }, [paintPassingItems]);

  const clearPassingItems = useCallback(() => {
    if (passingAnimationRef.current !== null) cancelAnimationFrame(passingAnimationRef.current);
    passingAnimationRef.current = null;
    itemRefs.current.forEach((item) => {
      if (!item) return;
      item.style.filter = "";
      item.style.opacity = "";
      item.style.transform = "";
      item.classList.remove("is-pass-target");
    });
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

  const ensureIndicatorGlass = useCallback(() => {
    if (!indicatorGlassRef.current && indicatorRef.current) {
      indicatorGlassRef.current = attachCodepenSwitcherGlass(indicatorRef.current);
    }
    indicatorGlassRef.current?.rebuild();
  }, []);

  const clearInteraction = useCallback(() => {
    navWrapRef.current?.classList.remove("engaged");
    navRef.current?.classList.remove("dragging");
    navRef.current?.style.setProperty("--ga", "0");
    indicatorRef.current?.classList.remove("interacting", "is-jumping");
    indicatorGlassRef.current?.destroy();
    indicatorGlassRef.current = null;
    clearPassingItems();
  }, [clearPassingItems]);

  const finishNavigation = useCallback((index: number, href: string) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setPendingIndex(index);
    ensureIndicatorGlass();
    navWrapRef.current?.classList.remove("engaged");
    navRef.current?.classList.remove("dragging");
    indicatorRef.current?.classList.remove("interacting", "is-jumping");
    const duration = positionIndicator(index, true);
    paintPassingItems(index);
    animatePassingItems(index, duration + 80);
    if (href !== pathname) {
      document.documentElement.classList.add("app-route-pending");
      router.push(href);
    }
    settleTimer.current = setTimeout(() => {
      setPendingIndex(null);
      clearInteraction();
    }, duration + 20);
  }, [animatePassingItems, clearInteraction, ensureIndicatorGlass, paintPassingItems, pathname, positionIndicator, router]);

  const endPointerInteraction = useCallback((navigate: boolean) => {
    const state = dragRef.current;
    const selectedIndex = state.targetIndex;
    const selected = items[selectedIndex];
    state.pointerId = null;
    state.dragging = false;
    pointerAbortRef.current?.abort();
    pointerAbortRef.current = null;
    if (navigate && selected) {
      suppressClickRef.current = true;
      if (suppressClickTimer.current) clearTimeout(suppressClickTimer.current);
      suppressClickTimer.current = setTimeout(() => { suppressClickRef.current = false; }, 120);
      finishNavigation(selectedIndex, selected.href);
      return;
    }
    setPendingIndex(null);
    positionIndicator(activeIndexRef.current, true);
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
    setGlow(event.clientX, event.clientY, state.dragging ? 0.18 : 0.22);
    if (!state.dragging) return;
    event.preventDefault();
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const localX = toLocalX(event.clientX);
    const width = state.pressWidth || itemMetrics(activeIndexRef.current)?.width || 0;
    const left = Math.min(nav.clientWidth - width + 22, Math.max(-22, localX - width / 2));
    indicator.style.transition = "none";
    indicator.style.left = `${left}px`;
    indicator.style.width = `${width}px`;
    state.targetIndex = nearestIndex(localX);
    paintPassingItems(state.targetIndex);
  }, [itemMetrics, nearestIndex, paintPassingItems, setGlow, toLocalX]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (event.pointerId === dragRef.current.pointerId) endPointerInteraction(true);
  }, [endPointerInteraction]);

  const handlePointerCancel = useCallback((event: PointerEvent) => {
    if (event.pointerId === dragRef.current.pointerId) endPointerInteraction(false);
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
    ensureIndicatorGlass();
    paintPassingItems(index);
    setGlow(event.clientX, event.clientY, 0.24);
    pointerAbortRef.current?.abort();
    const pointerAbort = new AbortController();
    pointerAbortRef.current = pointerAbort;
    window.addEventListener("pointermove", handlePointerMove, { passive: false, signal: pointerAbort.signal });
    window.addEventListener("pointerup", handlePointerUp, { signal: pointerAbort.signal });
    window.addEventListener("pointercancel", handlePointerCancel, { signal: pointerAbort.signal });
  };

  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  useEffect(() => {
    usePassingBlurRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => ["/", "/trips", "/trip-ideas", "/analytics", "/settings"].forEach((href) => {
      if (href !== pathname) router.prefetch(href);
    }), 160);
    return () => clearTimeout(timer);
  }, [pathname, router]);

  useEffect(() => {
    const nav = navWrapRef.current;
    if (!nav) return;
    navGlassRef.current = attachCodepenNavGlass(nav);
    const root = document.documentElement;
    let dark = root.classList.contains("dark");
    const rebuildForTheme = () => {
      const nextDark = root.classList.contains("dark");
      if (nextDark === dark) return;
      dark = nextDark;
      if (themeRebuildFrameRef.current !== null) cancelAnimationFrame(themeRebuildFrameRef.current);
      themeRebuildFrameRef.current = requestAnimationFrame(() => {
        navGlassRef.current?.rebuild();
        indicatorGlassRef.current?.rebuild();
        themeRebuildFrameRef.current = null;
      });
    };
    const themeObserver = new MutationObserver(rebuildForTheme);
    themeObserver.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      themeObserver.disconnect();
      if (themeRebuildFrameRef.current !== null) {
        cancelAnimationFrame(themeRebuildFrameRef.current);
        themeRebuildFrameRef.current = null;
      }
      navGlassRef.current?.destroy();
      navGlassRef.current = null;
    };
  }, [navVisible]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      positionIndicator(visualIndex, positionedRef.current);
      positionedRef.current = true;
      navGlassRef.current?.rebuild();
    });
    const handleResize = () => {
      positionIndicator(visualIndex, false);
      navGlassRef.current?.rebuild();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [positionIndicator, visualIndex]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const wasVisible = navWasVisibleRef.current;
    navWasVisibleRef.current = navVisible;
    root.classList.toggle("has-app-bottom-navigation", navVisible);
    document.documentElement.classList.remove("app-route-pending");
    if (!navVisible) {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      pointerAbortRef.current?.abort();
      pointerAbortRef.current = null;
      dragRef.current.pointerId = null;
      dragRef.current.dragging = false;
      positionedRef.current = false;
      requestAnimationFrame(() => setPendingIndex(null));
      clearInteraction();
    } else if (!wasVisible) {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      pointerAbortRef.current?.abort();
      pointerAbortRef.current = null;
      dragRef.current.pointerId = null;
      dragRef.current.dragging = false;
      activeIndexRef.current = activeIndex;
      positionedRef.current = false;
      clearInteraction();
      positionIndicator(activeIndex, false);
      requestAnimationFrame(() => setPendingIndex(null));
    }
  }, [activeIndex, clearInteraction, navVisible, pathname, positionIndicator]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (suppressClickTimer.current) clearTimeout(suppressClickTimer.current);
    pointerAbortRef.current?.abort();
    clearInteraction();
    document.documentElement.classList.remove("has-app-bottom-navigation");
  }, [clearInteraction]);

  if (!navVisible) return null;

  return (
    <nav ref={navWrapRef} className="app-bottom-navigation ios26-nav codepen-nav" aria-label="เมนูหลัก">
      <div ref={navRef} className="app-bottom-navigation-inner ios26-nav-inner">
        <span className="app-bottom-navigation-glow" aria-hidden="true" />
        <span ref={indicatorRef} className="app-bottom-navigation-indicator tab-indicator" aria-hidden="true" />
        {items.map(({ label, href, icon, active }, index) => {
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
                <NavIcon className="ios-icon" name={icon} filled={visuallyActive} />
                <span className="app-bottom-navigation-label">{label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
