"use client";

import { useEffect, type ReactNode } from "react";
import { LiquidGlassScene } from "simple-liquid-glass/backdrop";
import { AppBottomNavigation } from "@/src/components/app-bottom-navigation";
import { IosNavigationMotion } from "@/src/components/ios-navigation-motion";

export function AppGlassScene({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    const sheetSelector = ".modal-backdrop,.trip-idea-modal-backdrop";
    const editorSelector = "input,textarea,select,[contenteditable='true']";
    const timers = new Set<number>();
    const resetDismissedSheets = () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.matches(editorSelector) &&
        active.closest(sheetSelector)
      ) return;
      document.querySelectorAll<HTMLElement>(sheetSelector).forEach((sheet) => {
        sheet.style.removeProperty("--modal-viewport-height");
        sheet.style.removeProperty("--modal-viewport-top");
        sheet.classList.add("sheet-keyboard-dismissed");
      });
    };
    const scheduleReset = () => {
      [0, 180, 500].forEach((delay) => {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          resetDismissedSheets();
        }, delay);
        timers.add(timer);
      });
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      event.target.closest(sheetSelector)?.classList.remove("sheet-keyboard-dismissed");
    };
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", scheduleReset, true);
    window.visualViewport?.addEventListener("resize", scheduleReset, { passive: true });
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", scheduleReset, true);
      window.visualViewport?.removeEventListener("resize", scheduleReset);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <LiquidGlassScene className="app-glass-scene" maxCacheBytes={48 * 1024 * 1024}>
      <div className="app-glass-scene-content"><IosNavigationMotion>{children}</IosNavigationMotion></div>
      <AppBottomNavigation />
    </LiquidGlassScene>
  );
}
