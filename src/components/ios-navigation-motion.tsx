"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

type BackAction = () => void;
type IosNavigationMotionValue = { back: (action: BackAction) => void };

const IosNavigationMotionContext = createContext<IosNavigationMotionValue>({
  back: (action) => action(),
});

const DETAIL_ROUTE = /^\/trips\/[^/]+(?:\/(?:itinerary|expenses|documents\/[^/]+))?$/;
const scrollPositions = new Map<string, number>();

function isDetailRoute(pathname: string) {
  return DETAIL_ROUTE.test(pathname);
}

export function IosNavigationMotion({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const edgeGuardRef = useRef<HTMLDivElement | null>(null);
  const previousPathRef = useRef(pathname);
  const pendingBackRef = useRef(false);
  const completingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    startedAt: 0,
  });

  const clearMotion = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    completingRef.current = false;
    const content = contentRef.current;
    if (!content) return;
    content.classList.remove(
      "ios-route-enter-forward",
      "ios-route-enter-back",
      "ios-route-exit-back",
      "ios-route-swiping",
      "ios-route-swipe-cancel",
      "ios-route-swipe-complete",
    );
    content.style.removeProperty("transform");
    content.style.removeProperty("opacity");
    content.style.removeProperty("transition");
  }, []);

  const back = useCallback((action: BackAction) => {
    if (completingRef.current) return;
    pendingBackRef.current = isDetailRoute(pathname);
    action();
  }, [pathname]);

  useLayoutEffect(() => {
    const previousPath = previousPathRef.current;
    if (previousPath === pathname) return;
    previousPathRef.current = pathname;
    const wasBack = pendingBackRef.current;
    pendingBackRef.current = false;
    clearMotion();
    if (wasBack) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo({ top: scrollPositions.get(pathname) || 0, behavior: "auto" });
      }));
    }
  }, [clearMotion, pathname]);

  useEffect(() => {
    const saveScroll = () => scrollPositions.set(pathname, window.scrollY);
    saveScroll();
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      saveScroll();
      window.removeEventListener("scroll", saveScroll);
    };
  }, [pathname]);

  const onTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    event.preventDefault();
    const touch = event.touches[0];
    gestureRef.current = {
      active: isDetailRoute(pathname) && !document.documentElement.matches(".sheet-open,.confirm-open"),
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      startedAt: performance.now(),
    };
  }, [pathname]);

  const onTouchMove = useCallback((event: TouchEvent) => {
    // The edge guard owns the gesture so Safari cannot turn it into browser history navigation.
    event.preventDefault();
    const gesture = gestureRef.current;
    const content = contentRef.current;
    if (!gesture.active || !content || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = Math.max(0, touch.clientX - gesture.startX);
    const dy = Math.abs(touch.clientY - gesture.startY);
    if (dy > dx && dx < 12) return;
    gesture.currentX = touch.clientX;
    const progress = Math.min(1, dx / Math.max(1, window.innerWidth));
    content.classList.add("ios-route-swiping");
    content.style.transform = `translate3d(${dx}px,0,0)`;
    content.style.opacity = String(1 - progress * 0.14);
  }, []);

  const finishSwipe = useCallback(() => {
    const gesture = gestureRef.current;
    const content = contentRef.current;
    const wasActive = gesture.active;
    gesture.active = false;
    if (!wasActive || !content) return;
    const distance = Math.max(0, gesture.currentX - gesture.startX);
    const elapsed = Math.max(1, performance.now() - gesture.startedAt);
    const shouldGoBack = distance >= Math.min(110, window.innerWidth * 0.28) || distance / elapsed > 0.55;
    content.classList.remove("ios-route-swiping");
    if (!shouldGoBack) {
      content.classList.add("ios-route-swipe-cancel");
      content.style.transform = "translate3d(0,0,0)";
      content.style.opacity = "1";
      timerRef.current = setTimeout(clearMotion, 190);
      return;
    }
    completingRef.current = true;
    pendingBackRef.current = true;
    clearMotion();
    router.back();
  }, [clearMotion, router]);

  useEffect(() => {
    const guard = edgeGuardRef.current;
    if (!guard) return;
    const finish = () => finishSwipe();
    guard.addEventListener("touchstart", onTouchStart, { passive: false });
    guard.addEventListener("touchmove", onTouchMove, { passive: false });
    guard.addEventListener("touchend", finish, { passive: false });
    guard.addEventListener("touchcancel", finish, { passive: false });
    return () => {
      guard.removeEventListener("touchstart", onTouchStart);
      guard.removeEventListener("touchmove", onTouchMove);
      guard.removeEventListener("touchend", finish);
      guard.removeEventListener("touchcancel", finish);
    };
  }, [finishSwipe, onTouchMove, onTouchStart]);

  return (
    <IosNavigationMotionContext.Provider value={{ back }}>
      <div ref={contentRef} className="ios-navigation-motion">{children}</div>
      <div
        ref={edgeGuardRef}
        className="ios-native-back-guard"
        aria-hidden="true"
      />
    </IosNavigationMotionContext.Provider>
  );
}

export function useIosNavigationMotion() {
  return useContext(IosNavigationMotionContext);
}
