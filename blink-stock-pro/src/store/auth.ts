import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User as SupaUser } from "@supabase/supabase-js";

export type Role = "admin" | "manager" | "cashier";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  store: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  init: () => () => void;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

async function loadProfile(supaUser: SupaUser): Promise<User> {
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("display_name, store").eq("user_id", supaUser.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", supaUser.id).order("role", { ascending: true }).limit(1).maybeSingle(),
  ]);
  return {
    id: supaUser.id,
    email: supaUser.email ?? "",
    name: profile?.display_name ?? supaUser.email?.split("@")[0] ?? "User",
    store: profile?.store ?? "Flagship · Downtown",
    role: (roleRow?.role as Role) ?? "cashier",
  };
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,

  init: () => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session?.user) {
        // Defer to avoid deadlock inside the auth callback
        setTimeout(() => {
          loadProfile(session.user).then((user) => set({ user, loading: false }));
        }, 0);
      } else {
        set({ user: null, loading: false });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session });
      if (session?.user) {
        loadProfile(session.user).then((user) => set({ user, loading: false }));
      } else {
        set({ loading: false });
      }
    });

    return () => sub.subscription.unsubscribe();
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  },

  signup: async (name, email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name },
      },
    });
    return error ? { error: error.message } : {};
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

export const roleHome: Record<Role, string> = {
  cashier: "/pos",
  manager: "/inventory",
  admin: "/dashboard",
};