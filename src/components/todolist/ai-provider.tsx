"use client";

// Global AI state provider.
//
// Currently tracks:
//   - whether AI features are available (set to false if any AI call
//     returns a config/availability error, so we can hide AI buttons)
//   - a global "busy" flag for showing a loading indicator when AI
//     operations are in flight
//
// In the future this can also hold per-feature toggles (e.g. user
// preferences for which AI features to show).

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface AIContextValue {
  /** True if at least one AI call has succeeded. False until first call. */
  available: boolean | null; // null = unknown (not yet tested)
  /** True if AI is known to be unavailable (config missing etc). */
  disabled: boolean;
  /** Track in-flight AI operations for UI feedback. */
  busy: boolean;
  markAvailable: () => void;
  markUnavailable: () => void;
  setBusy: (b: boolean) => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const markAvailable = useCallback(() => setAvailable(true), []);
  const markUnavailable = useCallback(() => setAvailable(false), []);

  return (
    <AIContext.Provider
      value={{
        available,
        disabled: available === false,
        busy,
        markAvailable,
        markUnavailable,
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
// when no provider is mounted (e.g. deep in legacy code paths).
export function useAIOptional(): AIContextValue | null {
  return useContext(AIContext);
}
