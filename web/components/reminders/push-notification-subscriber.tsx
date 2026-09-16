"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushNotificationSubscriber() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_KEY
    ) return;

    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => null);
  }, []);

  if (!supported) return null;
  if (permission === "denied") {
    return (
      <span className="text-xs text-[#55433d]/50 flex items-center gap-1.5">
        <BellOff className="h-3.5 w-3.5" />
        Alerts blocked in browser settings
      </span>
    );
  }

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Notification permission denied.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY!),
      });

      const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh:   json.keys?.p256dh ?? "",
          auth:     json.keys?.auth ?? "",
        }),
      });

      if (res.ok) {
        setSubscribed(true);
        toast.success("Push alerts enabled for overdue reminders.");
      } else {
        await sub.unsubscribe();
        toast.error("Failed to save subscription. Please try again.");
      }
    } catch (err) {
      console.error("[push] subscribe failed:", err);
      toast.error("Could not enable push alerts.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Unsubscribe browser FIRST: if the server DELETE fails, the push service
        // will return 410 Gone on the next delivery attempt and sendUserPushNotifications
        // will auto-remove the stale record. Reverse order leaves an orphan server
        // record that never self-heals.
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
      toast.success("Push alerts disabled.");
    } catch (err) {
      console.error("[push] unsubscribe failed:", err);
      toast.error("Could not disable push alerts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={subscribed ? handleUnsubscribe : handleSubscribe}
      disabled={loading}
      className="flex items-center gap-2 text-sm text-[#55433d]/70 hover:text-[#99462a] transition-colors disabled:opacity-50"
      title={subscribed ? "Disable overdue reminder push alerts" : "Enable overdue reminder push alerts"}
    >
      {subscribed
        ? <BellOff className="h-4 w-4" />
        : <Bell    className="h-4 w-4" />}
      {loading
        ? "Updating..."
        : subscribed
          ? "Disable push alerts"
          : "Enable push alerts"}
    </button>
  );
}
