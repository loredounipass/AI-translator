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


    // MANAGE SUPABASE AUTH SESSION AND VISIBILITY REFRESH
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

        const fetchSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            updateState(session);
        };

        fetchSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            updateState(session);
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                fetchSession();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);


    // REGISTER USER WITH EMAIL AND PASSWORD
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


    // LOGIN USER WITH EMAIL AND PASSWORD
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


    // LOGOUT USER
    const logout = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, registerWithEmail, loginWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
};


// CUSTOM HOOK TO ACCESS AUTH CONTEXT
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};


// MAP SUPABASE AUTH ERRORS TO LOCALIZED MESSAGES
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

    return AUTH_ERRORS.UNKNOWN;
}
