import Link from "next/link";
import { catalogComponentIndex } from "@/lib/catalog";
import { ComponentIndex } from "@/components/ComponentIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Components — Fallen Cycles",
};

export default async function ComponentsPage() {
  const rows = await catalogComponentIndex();
  const totalParts = rows.reduce((n, r) => n + r.parts, 0);

  return (
    <div>
      <Link
        href="/catalog"
        style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}
      >
        ← Parts catalog
      </Link>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "4px 16px",
          marginTop: 10,
        }}
      >
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Components</h1>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
          {rows.length.toLocaleString()} components · {totalParts.toLocaleString()} parts
        </div>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Every component section across the catalog, with its part count. Pick one to see its
        parts.
      </p>
      <ComponentIndex rows={rows} />
    </div>
  );
}
