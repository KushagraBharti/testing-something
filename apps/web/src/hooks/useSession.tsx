import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface SessionState {
  userId: string | null;
  handle: string | null;
  token: string | null;
  expiresAt?: number | null;
}

interface SessionContextValue {
  session: SessionState;
  setSession: (next: SessionState) => void;
  clearSession: () => void;
}

const STORAGE_KEY = "pulse-kit-session";

const defaultState: SessionState = {
  userId: null,
  handle: null,
  token: null,
  expiresAt: null,
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<SessionState>(() => {
    if (typeof window === "undefined") {
      return defaultState;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return defaultState;
      const parsed = JSON.parse(stored) as SessionState;
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        window.localStorage.removeItem(STORAGE_KEY);
        return defaultState;
      }
      return { ...defaultState, ...parsed };
    } catch (error) {
      return defaultState;
    }
  });

  useEffect(() => {
    if (session.token) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const setSession = useCallback((next: SessionState) => {
    setSessionState(next);
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(defaultState);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      setSession,
      clearSession,
    }),
    [session, setSession, clearSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
};
