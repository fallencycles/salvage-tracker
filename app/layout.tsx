import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fallen Cycles",
  description: "Salvage intake to sale — tracked by stock number.",
};

// Every page reads live data from Postgres per request — nothing is
// statically prerendered at build time.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/catalog", label: "Parts Catalog" },
  { href: "/intake", label: "Intake" },
  { href: "/teardown", label: "Teardown" },
  { href: "/cataloging", label: "Cataloging" },
  { href: "/detailing", label: "Detailing" },
  { href: "/photography", label: "Photography" },
  { href: "/listings", label: "Listings" },
  { href: "/shipping", label: "Shipping" },
  { href: "/orders", label: "Orders & Returns" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
      </body>
    </html>
  );
}
