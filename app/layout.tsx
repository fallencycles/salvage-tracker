import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

export const metadata: Metadata = {
  title: "Fallen Cycles",
  description: "Salvage intake to sale — tracked by stock number.",
};

// Every page reads live data from Postgres per request — nothing is
// statically prerendered at build time.
export const dynamic = "force-dynamic";

// Only the parts catalog is exposed for now. The rest of the pipeline pages
// (Overview, Intake, Teardown, …) still exist and work by URL — restore them
// here when the operational side is ready.
const NAV = [{ href: "/catalog", label: "Parts Catalog" }];

async function gatePassed(): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password) return true; // gate disabled
  const token = (await cookies()).get("fc_gate")?.value;
  if (!token) return false;
  return token === createHash("sha256").update(`fc-gate:${password}`).digest("hex");
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const passed = await gatePassed();

  return (
    <html lang="en">
      <body>
        {passed ? (
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <nav
              style={{
                width: 210,
                flexShrink: 0,
                borderRight: "1px solid var(--border)",
                padding: "20px 0",
              }}
            >
              <div
                style={{
                  padding: "0 20px 20px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                FALLEN CYCLES
              </div>
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "9px 20px",
                    fontSize: 14,
                    color: "var(--ink-dim)",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <main style={{ flex: 1, padding: "28px 36px", maxWidth: 1100 }}>{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
