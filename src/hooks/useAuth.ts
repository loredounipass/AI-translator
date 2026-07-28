import { useState, useEffect, useCallback } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "utils/supabaseClient";
import { AUTH_ERRORS } from "utils/authConstants";

interface AuthState {
    session: Session | null;
    user: User | null;
    loading: boolean;
    needsEmailVerification: boolean;
}

export const useAuth = () => {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        loading: true,
        needsEmailVerification: false,
    });

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setState({
                session,
                user: session?.user ?? null,
                loading: false,
                needsEmailVerification: session?.user?.email_confirmed_at ? false : !!session?.user,
            });
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setState({
                session,
                user: session?.user ?? null,
                loading: false,
                needsEmailVerification: session?.user?.email_confirmed_at ? false : !!session?.user,
            });
        });

        return () => subscription.unsubscribe();
    }, []);

    const registerWithEmail = useCallback(
        async (
            email: string,
            password: string,
            metadata?: { firstName?: string; lastName?: string; phone?: string }
        ): Promise<{ error: string | null; needsVerification?: boolean }> => {
            const { data, error } = await supabase.auth.signUp({
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

            if (error) {
                return { error: mapSupabaseError(error) };
            }

            const needsVerification = !data.user?.email_confirmed_at;
            return { error: null, needsVerification };
        },
        []
    );

    const loginWithEmail = useCallback(
        async (email: string, password: string): Promise<{ error: string | null }> => {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { error: mapSupabaseError(error) };
            }

            return { error: null };
        },
        []
    );

    const logout = useCallback(async () => {
        await supabase.auth.signOut({ scope: "global" });
    }, []);

    return {
        user: state.user,
        session: state.session,
        loading: state.loading,
        needsEmailVerification: state.needsEmailVerification,
        registerWithEmail,
        loginWithEmail,
        logout,
    };
};

function mapSupabaseError(error: AuthError): string {
    const message = error.message.toLowerCase();

    if (message.includes("invalid login credentials")) {
        return AUTH_ERRORS.INVALID_CREDENTIALS;
    }
    if (message.includes("password") && message.includes("characters")) {
        return AUTH_ERRORS.WEAK_PASSWORD;
    }
    if (message.includes("network") || message.includes("fetch")) {
        return AUTH_ERRORS.NETWORK_ERROR;
    }
    // Generic message for all other errors (prevents email enumeration)
    return AUTH_ERRORS.UNKNOWN;
}
