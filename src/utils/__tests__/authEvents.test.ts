import { isAuthExpiredError, notifyAuthExpired, AUTH_EXPIRED_EVENT } from "../authEvents";

// Supabase errors are PLAIN OBJECTS (PostgrestError/AuthError), not Error
// instances: the detector must read status/message off the object itself
describe("auth expiry detection", () => {
  it("detects a PostgREST 401 (expired JWT) plain object", () => {
    expect(isAuthExpiredError({ code: "PGRST301", details: null, hint: null, message: "JWT expired", status: 401, statusCode: "401" })).toBe(true);
  });

  it("detects a gotrue invalid_grant refresh failure", () => {
    expect(isAuthExpiredError({ message: "invalid_grant: Invalid Refresh Token", status: 400 })).toBe(true);
  });

  it("does NOT flag ordinary errors: RLS violation, network, null", () => {
    expect(isAuthExpiredError({ message: "new row violates row-level security policy", status: 403, code: "23505" })).toBe(false);
    expect(isAuthExpiredError({ message: "Failed to fetch" })).toBe(false);
    expect(isAuthExpiredError(null)).toBe(false);
    expect(isAuthExpiredError(undefined)).toBe(false);
  });

  it("dispatches the auth:expired window event only for expiry errors", () => {
    let fired = 0;
    const listener = () => { fired++; };
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);

    expect(notifyAuthExpired({ message: "JWT expired", status: 401 })).toBe(true);
    expect(fired).toBe(1);

    expect(notifyAuthExpired({ message: "permission denied", status: 403 })).toBe(false);
    expect(fired).toBe(1);

    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });
});
