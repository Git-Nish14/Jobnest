"use client";

import * as React from "react";

const TAP_SLOP = 10;
const COMPATIBILITY_CLICK_WINDOW = 750;

type TouchGesture = {
  pointerId: number;
  x: number;
  y: number;
  cancelled: boolean;
  endedAt: number | null;
};

export function isTouchPointer(event: { pointerType: string }) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

/**
 * Track a gesture through release/cancel even when a primitive releases implicit
 * pointer capture. Never cancel movement: native vertical/horizontal scrolling
 * and pinch zoom must remain available. Only a stray click after a drag is blocked.
 */
export function useTouchClickGuard<T extends HTMLElement>() {
  const gesture = React.useRef<TouchGesture | null>(null);
  const stopListening = React.useRef<(() => void) | null>(null);

  React.useEffect(() => () => stopListening.current?.(), []);

  const onPointerDownCapture = (event: React.PointerEvent<T>) => {
    stopListening.current?.();
    gesture.current = null;
    if (!isTouchPointer(event)) return;

    const current: TouchGesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cancelled: !event.isPrimary || event.defaultPrevented,
      endedAt: null,
    };
    gesture.current = current;
    const ownerDocument = event.currentTarget.ownerDocument;

    const trackMovement = (pointer: PointerEvent) => {
      if (pointer.pointerId !== current.pointerId) return;
      if (
        Math.abs(pointer.clientX - current.x) > TAP_SLOP ||
        Math.abs(pointer.clientY - current.y) > TAP_SLOP
      ) {
        current.cancelled = true;
      }
    };
    const finish = (pointer: PointerEvent) => {
      if (pointer.pointerId !== current.pointerId) return;
      trackMovement(pointer);
      if (pointer.type === "pointercancel") current.cancelled = true;
      current.endedAt = performance.now();
      stopListening.current?.();
    };
    const cancelForAdditionalPointer = (pointer: PointerEvent) => {
      if (pointer.pointerId !== current.pointerId) current.cancelled = true;
    };

    ownerDocument.addEventListener("pointermove", trackMovement, { capture: true, passive: true });
    ownerDocument.addEventListener("pointerup", finish, { capture: true, passive: true });
    ownerDocument.addEventListener("pointercancel", finish, { capture: true, passive: true });
    ownerDocument.addEventListener("pointerdown", cancelForAdditionalPointer, { capture: true, passive: true });
    stopListening.current = () => {
      ownerDocument.removeEventListener("pointermove", trackMovement, true);
      ownerDocument.removeEventListener("pointerup", finish, true);
      ownerDocument.removeEventListener("pointercancel", finish, true);
      ownerDocument.removeEventListener("pointerdown", cancelForAdditionalPointer, true);
      stopListening.current = null;
    };
  };

  const isRecentTouch = () => {
    const current = gesture.current;
    return current !== null && current.endedAt !== null &&
      performance.now() - current.endedAt < COMPATIBILITY_CLICK_WINDOW;
  };

  return {
    onPointerDownCapture,
    onClickCapture(event: React.MouseEvent<T>) {
      // Keyboard and assistive-technology activation do not represent a swipe.
      if (event.detail === 0 || !isRecentTouch() || !gesture.current?.cancelled) return;
      event.preventDefault();
      event.stopPropagation();
    },
    cancelTouch() {
      if (gesture.current) gesture.current.cancelled = true;
    },
    consumeTouchClick() {
      const isTap = isRecentTouch() && !gesture.current?.cancelled;
      gesture.current = null;
      return isTap;
    },
  };
}
