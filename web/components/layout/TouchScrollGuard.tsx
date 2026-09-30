"use client";

import { useEffect } from "react";

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='menuitem']",
  "[data-radix-collection-item]",
].join(",");

const MOVE_TOLERANCE = 10;
const SYNTHETIC_CLICK_WINDOW = 500;

/**
 * Mobile browsers normally suppress the click that follows a scroll gesture,
 * but fixed controls, nested horizontal scrollers, and some WebViews can still
 * dispatch it. Track the originating touch target and cancel only the click
 * synthesized from a gesture that travelled far enough to be a scroll.
 *
 * Keyboard clicks have detail=0 and are intentionally never blocked.
 */
export function TouchScrollGuard() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    let startX = 0;
    let startY = 0;
    let moved = false;
    let gestureTarget: Element | null = null;
    let blockUntil = 0;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      startX = touch.clientX;
      startY = touch.clientY;
      moved = false;
      blockUntil = 0;
      gestureTarget = event.target instanceof Element
        ? event.target.closest(INTERACTIVE_SELECTOR)
        : null;
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
      if (!(event.target instanceof Element) || !gestureTarget) return;

      const clickTarget = event.target.closest(INTERACTIVE_SELECTOR);
      if (clickTarget !== gestureTarget) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      moved = false;
      gestureTarget = null;
    };

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
