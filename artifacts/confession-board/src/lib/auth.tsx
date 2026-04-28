import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "confession-streamer-sessions-v2";

export interface StreamerSession {
  channelId: string;
  streamerName: string;
  token: string;
  nickname: string | null;
}

interface SessionMap {
  [channelId: string]: StreamerSession;
}

interface AuthState {
  /** All admin sessions the user currently holds, keyed by channelId. */
  sessions: SessionMap;
  /** Save / replace the admin session for a streamer. */
  setSession: (session: StreamerSession) => void;
  /** Remove the session for a single streamer. */
  clearSession: (channelId: string) => void;
  /** Remove every session. */
  clearAllSessions: () => void;
  /** Convenience accessor for the session of one streamer. */
  getSession: (channelId: string | null | undefined) => StreamerSession | null;
}

const AuthContext = createContext<AuthState | null>(null);

function loadSessions(): SessionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as SessionMap;
  } catch {
    // ignore corrupt storage
  }
  return {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionMap>({});

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const persist = useCallback((next: SessionMap) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSessions(next);
  }, []);

  const setSession = useCallback(
    (session: StreamerSession) => {
      const current = loadSessions();
      const next = { ...current, [session.channelId]: session };
      persist(next);
    },
    [persist],
  );

  const clearSession = useCallback(
    (channelId: string) => {
      const current = loadSessions();
      if (!(channelId in current)) return;
      const { [channelId]: _, ...rest } = current;
      persist(rest);
    },
    [persist],
  );

  const clearAllSessions = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSessions({});
  }, []);

  const getSession = useCallback(
    (channelId: string | null | undefined) => {
      if (!channelId) return null;
      return sessions[channelId] ?? null;
    },
    [sessions],
  );

  const value = useMemo<AuthState>(
    () => ({ sessions, setSession, clearSession, clearAllSessions, getSession }),
    [sessions, setSession, clearSession, clearAllSessions, getSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/**
 * Returns the session (if any) for a single streamer plus convenience flags.
 * Pass the streamer's channelId from the URL.
 */
export function useStreamerSession(channelId: string | null | undefined) {
  const { getSession } = useAuth();
  const session = getSession(channelId);
  return {
    session,
    token: session?.token ?? null,
    isStreamer: !!session,
    nickname: session?.nickname ?? null,
    streamerName: session?.streamerName ?? null,
  };
}
