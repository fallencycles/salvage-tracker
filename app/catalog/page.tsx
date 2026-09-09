import Link from "next/link";
import { CatalogSearch } from "@/components/CatalogSearch";
import {
  catalogCategoryLabels,
  catalogComponents,
  catalogModels,
  catalogStats,
} from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parts Catalog — Fallen Cycles",
};

export default async function CatalogPage() {
  const [stats, models, components, categories] = await Promise.all([
    catalogStats(),
    catalogModels(),
    catalogComponents(),
    catalogCategoryLabels(),
  ]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "4px 16px",
        }}
      >
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Parts catalog</h1>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
          {stats.parts.toLocaleString()} parts · {stats.fitmentRanges.toLocaleString()} fitment ranges
        </div>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 14, fontSize: 14 }}>
        Reference lookup — Harley part numbers, the components they belong to, and the
        models and years each one fits.{" "}
        <Link href="/catalog/components" style={{ color: "var(--tag-yellow)", textDecoration: "none" }}>
          Browse all components →
        </Link>
      </p>
      <CatalogSearch models={models} components={components} categories={categories} />
    </div>
  );
}
