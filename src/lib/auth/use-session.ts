import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "admin";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  isStudent: boolean;
};

/**
 * Client-side session + role listener. Fetches the initial session,
 * subscribes to auth state changes, and re-fetches roles from
 * `public.user_roles` (RLS-scoped to auth.uid()).
 */
export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    roles: [],
    isAdmin: false,
    isStudent: false,
  });

  useEffect(() => {
    let active = true;

    async function loadRoles(userId: string | null): Promise<AppRole[]> {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error || !data) return [];
      return data.map((r) => r.role as AppRole);
    }

    async function apply(session: Session | null) {
      const roles = await loadRoles(session?.user.id ?? null);
      if (!active) return;
      setState({
        loading: false,
        session,
        user: session?.user ?? null,
        roles,
        isAdmin: roles.includes("admin"),
        isStudent: roles.includes("student"),
      });
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      void apply(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** Sign out cleanly. Consumers should navigate() after awaiting. */
export async function signOut() {
  await supabase.auth.signOut();
}
