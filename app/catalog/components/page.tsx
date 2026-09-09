import Link from "next/link";
import { catalogComponentCategories } from "@/lib/catalog";
import { ComponentCategories } from "@/components/ComponentCategories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Components — Fallen Cycles",
};

export default async function ComponentsPage() {
  const categories = await catalogComponentCategories();
  const sections = categories.reduce((n, c) => n + c.members.length, 0);

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
          {categories.length} systems · {sections.toLocaleString()} sections
        </div>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Every component section across the catalog, rolled up by system. Open one to see its
        sections; pick a section to see its parts.
      </p>
      <ComponentCategories categories={categories} />
    </div>
  );
}
