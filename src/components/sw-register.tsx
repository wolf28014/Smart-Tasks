"use client";

import * as React from "react";

// Register the service worker for PWA offline support.
// Skipped during development to avoid caching dev assets.
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production to avoid stale caches during development
    if (process.env.NODE_ENV !== "production") return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Silently ignore — SW is a progressive enhancement
          console.warn("SW registration failed:", err);
        });
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
