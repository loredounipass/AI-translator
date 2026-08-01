import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "utils/supabaseClient";
import { AUTH_ERRORS } from "utils/authConstants";

interface AuthState {
    session: Session | null;
    user: User | null;
    loading: boolean;
    needsEmailVerification: boolean;
}

interface AuthContextType extends AuthState {
    registerWithEmail: (
        email: string,
        password: string,
        metadata?: { firstName?: string; lastName?: string; phone?: string }
    ) => Promise<{ error: string | null; needsVerification?: boolean }>;
    loginWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        loading: true,
        needsEmailVerification: false,
    });

    useEffect(() => {
        let mounted = true;

        const updateState = (session: Session | null) => {
            if (!mounted) return;
            setState({
                session,
                user: session?.user ?? null,
                loading: false,
                needsEmailVerification: session?.user?.email_confirmed_at ? false : !!session?.user,
            });
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            updateState(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            updateState(session);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
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
        await supabase.auth.signOut({ scope: "local" });
        // The onAuthStateChange listener will automatically clear the local state
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, registerWithEmail, loginWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
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
