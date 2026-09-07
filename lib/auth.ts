import { cookies } from "next/headers";

export type Role =
  | "intake"
  | "teardown"
  | "detailing"
  | "photography"
  | "listing"
  | "customer_service"
  | "admin";

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
}

// Trust-based auth for now: a session cookie set at login carries user id/name/role.
// This is NOT enforced at the DB level — anyone with the cookie can call any API route.
// If that ever needs to change, add role checks inside each route handler (see
// requireRole below for where that would plug in) or move to Supabase RLS.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const raw = store.get("salvage_session")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

// Stub for later: currently a no-op that just returns the user, so call sites
// are ready for real enforcement without needing to be rewritten.
export async function requireRole(_roles: Role[]): Promise<CurrentUser | null> {
  return getCurrentUser();
}
