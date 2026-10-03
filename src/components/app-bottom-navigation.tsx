"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavIcon } from "@/src/components/nav-icon";
import {
  attachCodepenNavGlass,
  attachCodepenSwitcherGlass,
} from "@/src/lib/codepen-switcher-glass";

const NAV_VISIBLE_PATHS = new Set([
  "/", "/trips", "/settings", "/analytics", "/trip-ideas",
]);


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
    { label: "เล็งไว้", href: "/trip-ideas", icon: "radar" as const, active: pathname === "/trip-ideas" },
    { label: "ทริป", href: "/trips", icon: "trip" as const, active: pathname === "/trips" },
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
