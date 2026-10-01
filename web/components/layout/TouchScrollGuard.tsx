"use client";

import { useEffect } from "react";

const MOVE_TOLERANCE = 10;
const SYNTHETIC_CLICK_WINDOW = 500;

/**
 * Mobile browsers normally suppress the click that follows a scroll gesture,
 * but fixed controls, nested horizontal scrollers, and some WebViews can still
 * dispatch it. Cancel the click synthesized after a gesture that travelled far
 * enough to be a scroll, even when the finger started on noninteractive content
 * and a fixed control moved beneath it. A new touch always starts fresh.
 *
 * Keyboard clicks have detail=0 and are intentionally never blocked.
 */
export function TouchScrollGuard() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    let startX = 0;
    let startY = 0;
    let moved = false;
    let blockUntil = 0;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      startX = touch.clientX;
      startY = touch.clientY;
      moved = false;
      blockUntil = 0;
    };

    const onTouchEnd = () => {
      if (moved) blockUntil = performance.now() + SYNTHETIC_CLICK_WINDOW;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      if (
        Math.abs(touch.clientX - startX) > MOVE_TOLERANCE ||
        Math.abs(touch.clientY - startY) > MOVE_TOLERANCE
      ) {
        moved = true;
        blockUntil = performance.now() + SYNTHETIC_CLICK_WINDOW;
      }
    };

    const onClick = (event: MouseEvent) => {
      if (!moved || event.detail === 0 || performance.now() > blockUntil) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      moved = false;
    };

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
