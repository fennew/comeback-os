"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, X } from "lucide-react";

interface PushContext {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | "default";
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

const PushCtx = createContext<PushContext>({
  isSupported: false,
  isSubscribed: false,
  permission: "default",
  subscribe: async () => {},
  unsubscribe: async () => {},
});

export function usePushNotifications() {
  return useContext(PushCtx);
}

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showBanner, setShowBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (sub) {
          setIsSubscribed(true);
        } else if (Notification.permission === "default") {
          // Show banner after a short delay if not yet decided
          const dismissed = localStorage.getItem("push-banner-dismissed");
          if (!dismissed) {
            setTimeout(() => setShowBanner(true), 3000);
          }
        }
      })
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration) return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      setIsSubscribed(true);
      setShowBanner(false);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    }
  }, [registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, [registration]);

  function dismissBanner() {
    setShowBanner(false);
    localStorage.setItem("push-banner-dismissed", "1");
  }

  return (
    <PushCtx.Provider value={{ isSupported, isSubscribed, permission, subscribe, unsubscribe }}>
      {children}

      {/* Permission banner */}
      {showBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-lg">
            <Bell className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Enable notifications</p>
              <p className="text-xs text-muted-foreground">Get notified when agents complete work</p>
            </div>
            <Button size="sm" onClick={subscribe}>
              Enable
            </Button>
            <button onClick={dismissBanner} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </PushCtx.Provider>
  );
}

// Small toggle button for settings or header
export function PushNotificationToggle() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={isSubscribed ? unsubscribe : subscribe}
      title={isSubscribed ? "Disable notifications" : "Enable notifications"}
    >
      {isSubscribed ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}
