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
    const keyboardEditorSelector = [
      "textarea",
      "[contenteditable='true']",
      "input:not([type])",
      "input[type='text']",
      "input[type='search']",
      "input[type='email']",
      "input[type='number']",
      "input[type='password']",
      "input[type='tel']",
      "input[type='url']",
    ].join(",");
    const timers = new Set<number>();
    const isCompactViewport = () => window.matchMedia("(max-width: 900px)").matches;
    let restingViewportHeight = window.visualViewport?.height || window.innerHeight;
    let viewportWidth = window.visualViewport?.width || window.innerWidth;
    const syncKeyboardFooter = () => {
      const active = document.activeElement;
      const activeEditor =
        active instanceof HTMLElement && active.matches(keyboardEditorSelector)
          ? active
          : null;
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight;
      const currentViewportWidth = window.visualViewport?.width || window.innerWidth;
      if (Math.abs(currentViewportWidth - viewportWidth) > 80) {
        viewportWidth = currentViewportWidth;
        restingViewportHeight = currentViewportHeight;
      } else if (!activeEditor) {
        restingViewportHeight = Math.max(restingViewportHeight, currentViewportHeight);
      }
      const viewportWasReduced = window.visualViewport
        ? restingViewportHeight - currentViewportHeight > 100
        : true;
      document.querySelectorAll<HTMLElement>(sheetSelector).forEach((sheet) => {
        const keyboardIsOpen =
          isCompactViewport() &&
          Boolean(activeEditor) &&
          viewportWasReduced &&
          sheet.contains(activeEditor);
        sheet.classList.toggle("sheet-keyboard-open", keyboardIsOpen);
      });
    };
    const resetDismissedSheets = () => {
      syncKeyboardFooter();
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
      syncKeyboardFooter();
    };
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", scheduleReset, true);
    window.addEventListener("resize", scheduleReset, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleReset, { passive: true });
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", scheduleReset, true);
      window.removeEventListener("resize", scheduleReset);
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
