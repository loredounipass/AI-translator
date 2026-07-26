import { useState, useEffect, useCallback } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "utils/supabaseClient";
import { AUTH_ERRORS } from "utils/authConstants";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const registerWithEmail = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { firstName?: string; lastName?: string; phone?: string }
    ): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: metadata?.firstName || "",
            last_name: metadata?.lastName || "",
            phone: metadata?.phone || "",
            full_name: `${metadata?.firstName || ""} ${metadata?.lastName || ""}`.trim(),
          },
        },
      });

      if (!error) {
        return { error: null };
      }

      return { error: mapSupabaseError(error) };
    },
    []
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        return { error: null };
      }

      return { error: mapSupabaseError(error) };
    },
    []
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    registerWithEmail,
    loginWithEmail,
    logout,
  };
};

function mapSupabaseError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes("email already registered")) {
    return AUTH_ERRORS.EMAIL_IN_USE;
  }
  if (message.includes("invalid login credentials")) {
    return AUTH_ERRORS.INVALID_CREDENTIALS;
  }
  if (message.includes("password") && message.includes("characters")) {
    return AUTH_ERRORS.WEAK_PASSWORD;
  }
  if (message.includes("user not found")) {
    return AUTH_ERRORS.USER_NOT_FOUND;
  }
  if (message.includes("network")) {
    return AUTH_ERRORS.NETWORK_ERROR;
  }

  return AUTH_ERRORS.UNKNOWN;
}
