import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        "Supabase credentials not found. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file."
    );
}

const cookieStorage = {
    getItem: (key: string): string | null => {
        try {
            const cookies = document.cookie.split(";").map(c => c.trim());
            for (const cookie of cookies) {
                const eqIdx = cookie.indexOf("=");
                const name = eqIdx > -1 ? cookie.substring(0, eqIdx) : cookie;
                if (name === key) {
                    return decodeURIComponent(cookie.substring(eqIdx + 1));
                }
            }
        } catch { /* cookie not available */ }
        return null;
    },
    setItem: (key: string, value: string): void => {
        try {
            const isSecure = window.location.protocol === "https:";
            document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=28800; samesite=lax${isSecure ? "; secure" : ""}`;
        } catch { /* cookie not available */ }
    },
    removeItem: (key: string): void => {
        try {
            document.cookie = `${key}=; path=/; max-age=0`;
        } catch { /* cookie not available */ }
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: cookieStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
    },
});
