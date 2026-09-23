"use client";

import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

const POPOVER_WIDTH = 132;
const POPOVER_HEIGHT = 86;
const VIEWPORT_GAP = 8;
const ANCHOR_GAP = 4;

export function ChecklistActionPopover({
  anchor,
  children,
}: {
  anchor: HTMLElement | null;
  children: ReactNode;
}) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!anchor) return;

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const left = Math.min(
        window.innerWidth - POPOVER_WIDTH - VIEWPORT_GAP,
        Math.max(VIEWPORT_GAP, rect.right - POPOVER_WIDTH),
      );
      const hasSpaceBelow =
        rect.bottom + ANCHOR_GAP + POPOVER_HEIGHT <=
        window.innerHeight - VIEWPORT_GAP;
      const top = hasSpaceBelow
        ? rect.bottom + ANCHOR_GAP
        : Math.max(VIEWPORT_GAP, rect.top - POPOVER_HEIGHT - ANCHOR_GAP);

      setStyle({ left, top, visibility: "visible" });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor]);

  if (!anchor || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="checklist-action-popover checklist-action-popover-portal"
      style={style}
      role="menu"
    >
      {children}
    </div>,
    document.body,
  );
}
