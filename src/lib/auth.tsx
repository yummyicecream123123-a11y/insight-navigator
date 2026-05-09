import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Patch fetch once to attach Supabase bearer token to server-fn requests
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (w.__serverFnFetchPatched) return;
    w.__serverFnFetchPatched = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (input: any, init: any = {}) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("/_serverFn/")) {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
            if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
            init = { ...init, headers };
          }
        } catch {}
      }
      return orig(input, init);
    };
  }, []);

  return <Ctx.Provider value={{ user: session?.user ?? null, session, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
