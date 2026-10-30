import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { clearSynced, pull, push, setSyncSession } from "./sync";

// Sign in with Google. Google's button gives us an ID token, the API checks it
// and returns its own long-lived session, which is all we keep.

export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID ?? "";
const SESSION_KEY = "ufsSession";

export type Account = { email: string; name: string; picture: string; feed: string };

type AccountState = {
  user: Account | null;
  session: string | null;
  checking: boolean;
  signOut: () => Promise<void>;
  setFeed: (feed: string) => void;
};

const AccountContext = createContext<AccountState>({
  user: null,
  session: null,
  checking: false,
  signOut: async () => {},
  setFeed: () => {},
});

declare global {
  interface Window {
    google?: any;
  }
}

let scriptPromise: Promise<void> | null = null;
const loadGoogle = () =>
  (scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("google script"));
    };
    document.head.appendChild(script);
  }));

// Google calls one global callback, so it hands off to whichever provider is mounted
let onCredential: (credential: string) => void = () => {};
let initialized = false;
const initGoogle = async () => {
  await loadGoogle();
  if (!initialized) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => onCredential(response.credential),
    });
    initialized = true;
  }
  return window.google.accounts.id;
};

export const readSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

export const authHeaders = (session: string | null): Record<string, string> =>
  session ? { Authorization: `Bearer ${session}` } : {};

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<string | null>(readSession);
  const [user, setUser] = useState<Account | null>(null);
  const [checking, setChecking] = useState(() => readSession() !== null);

  const forget = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSyncSession(null);
    setSession(null);
    setUser(null);
  }, []);

  // check a saved session once on load
  useEffect(() => {
    const saved = readSession();
    if (!saved) return;
    fetch(`${API_BASE_URL}/api/me`, { headers: authHeaders(saved) })
      .then(async (r) => {
        if (r.status === 401) forget();
        else if (r.ok) setUser((await r.json()).user);
      })
      // offline: keep the session and try again next load
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [forget]);

  useEffect(() => {
    onCredential = async (credential) => {
      const r = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!r.ok) return;
      const data = await r.json();
      localStorage.setItem(SESSION_KEY, data.session);
      setSyncSession(data.session);
      setSession(data.session);
      setUser(data.user);
      // bring in what's saved in the account; reload so every screen picks it up
      if (await pull().catch(() => false)) window.location.reload();
    };
  }, []);

  // coming back to the tab: grab anything saved from another device
  useEffect(() => {
    if (!session) return;
    let last = Date.now();
    const onVisible = async () => {
      if (document.visibilityState === "hidden") {
        push();
        return;
      }
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      if (await pull().catch(() => false)) window.location.reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [session]);

  const signOut = useCallback(async () => {
    const current = readSession();
    // send unsaved edits first; the account's data then leaves this device and comes back on sign-in
    await push();
    if (current) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", headers: authHeaders(current) }).catch(() => {});
    }
    window.google?.accounts?.id?.disableAutoSelect();
    forget();
    clearSynced();
    window.location.reload();
  }, [forget]);

  const setFeed = useCallback((feed: string) => setUser((u) => (u ? { ...u, feed } : u)), []);

  return (
    <AccountContext.Provider value={{ user, session, checking, signOut, setFeed }}>{children}</AccountContext.Provider>
  );
};

export const useAccount = () => useContext(AccountContext);

/** Google's own sign-in button; they require it to look like theirs. */
export const GoogleButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let live = true;
    initGoogle()
      .then((id) => {
        if (!live || !ref.current) return;
        id.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: compact ? "medium" : "large",
          shape: "pill",
          text: compact ? "signin" : "signin_with",
          logo_alignment: "left",
        });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [compact]);

  if (!GOOGLE_CLIENT_ID) return null;
  if (failed) return <span className="auth-failed">Couldn't load Google sign-in</span>;
  return <div ref={ref} className="google-button" />;
};
