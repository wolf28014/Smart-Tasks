"use client";

// Global AI state provider.
//
// Tracks:
//   - whether AI features are enabled & configured (fetched from
//     /api/ai/settings on mount, refreshed when settings dialog saves)
//   - a global "busy" flag for showing a loading indicator when AI
//     operations are in flight
//
// Components that render AI entry points (buttons, banners) check
// `enabled` to decide whether to show themselves at all. When AI is
// not configured, the UI degrades gracefully without broken buttons.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AIContextValue {
  /** True if AI is enabled AND has a valid API key configured. */
  enabled: boolean;
  /** True if we've finished the initial settings fetch. */
  loaded: boolean;
  /** Track in-flight AI operations for UI feedback. */
  busy: boolean;
  /** Re-fetch AI settings from server (call after saving settings). */
  refresh: () => Promise<void>;
  setBusy: (b: boolean) => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/settings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEnabled(!!data.enabled && !!data.hasApiKey);
      } else {
        setEnabled(false);
      }
    } catch {
      setEnabled(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AIContext.Provider
      value={{
        enabled,
        loaded,
        busy,
        refresh,
        setBusy,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return ctx;
}

// Optional variant — components that want to gracefully render even
// when no provider is mounted.
export function useAIOptional(): AIContextValue | null {
  return useContext(AIContext);
}
