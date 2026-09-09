import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { Analytics } from "@vercel/analytics/next";

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
const NAV = [
  { href: "/catalog", label: "Parts Catalog" },
  { href: "/inquiries", label: "Customer Inquiries" },
];

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
          <div className="app-shell">
            <nav className="app-nav">
              <div className="app-nav-brand">FALLEN CYCLES</div>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <main className="app-main">{children}</main>
          </div>
        ) : (
          children
        )}
        <Analytics />
      </body>
    </html>
  );
}
