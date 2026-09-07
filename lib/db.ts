import { Pool } from "pg";

// A single pooled connection, driven off an env var so Vercel (which can't
// resolve IPv6 directly) always gets an explicit connection string.
let pool: Pool | null = null;

// Supabase (and most hosted Postgres) terminate TLS with a cert chain that isn't
// in Node's default CA bundle, and recent `pg` treats sslmode=require as
// verify-full. For any non-local host: strip sslmode from the string and encrypt
// without chain verification via an explicit ssl object.
function pgConfig(raw: string | undefined) {
  const cs = raw ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(cs);
  if (isLocal) return { connectionString: cs };
  return {
    connectionString: cs.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, p1, p2) =>
      p2 === "&" ? p1 : ""
    ),
    ssl: { rejectUnauthorized: false },
  };
}

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ ...pgConfig(process.env.DATABASE_URL), max: 10 });
  }
  return pool;
}

// NOTE: never call .end() on this pool in request-handling code. Only tear it
// down in scripts/tests that own the process lifecycle.
