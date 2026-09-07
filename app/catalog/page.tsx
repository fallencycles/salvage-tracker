import { CatalogSearch } from "@/components/CatalogSearch";
import { catalogModelCodes, catalogStats } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parts Catalog — Fallen Cycles",
};

export default async function CatalogPage() {
  const [stats, modelCodes] = await Promise.all([catalogStats(), catalogModelCodes()]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Parts catalog</h1>
        <div style={{ fontSize: 12.5, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
          {stats.parts.toLocaleString()} parts · {stats.fitmentRanges.toLocaleString()} fitment ranges
        </div>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 24 }}>
        Reference lookup — Harley part numbers, the components they belong to, and the
        models and years each one fits. Full-text search across descriptions, components,
        and part numbers.
      </p>
      <CatalogSearch modelCodes={modelCodes} />
    </div>
  );
}
