// Shared plumbing for "the session died under the user".
// Supabase services swallow PostgREST errors and return empty values, so a
// 401 (expired JWT) is indistinguishable from "no data" for the user. Every
// service error branch calls notifyAuthExpired(); AuthContext turns the event
// into a throttled toast and App reopens the login modal.

export const AUTH_EXPIRED_EVENT = "auth:expired";

// Supabase errors are plain objects (PostgrestError/AuthError), NOT Error
// instances: read .status/.message off the object itself
export const isAuthExpiredError = (error: any): boolean => {
    if (!error) return false;
    if (error.status === 401 || error.statusCode === 401) return true;
    const msg = String(error.message || "").toLowerCase();
    return (
        msg.includes("jwt expired") ||
        msg.includes("invalid_grant") ||
        msg.includes("token has expired") ||
        msg.includes("refresh token")
    );
};

// Returns true when the error was an auth-expiry and the app was notified
export const notifyAuthExpired = (error: any): boolean => {
    if (!isAuthExpiredError(error)) return false;
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    return true;
};
