"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FitmentRange = {
  model_code: string;
  model_family: string | null;
  year_start: number;
  year_end: number;
};

type CatalogOccurrence = {
  component: string | null;
  description: string | null;
  page: number | null;
  source_catalog: string | null;
  model_family: string | null;
  international: boolean;
  diagram_url: string | null;
  diagram_page: number | null;
};

type CatalogResult = {
  part_no: string;
  part_no_normalized: string;
  description: string | null;
  component: string | null;
  model_count: number;
  occurrences: CatalogOccurrence[];
  fitment: FitmentRange[];
};

type SearchResponse = {
  results: CatalogResult[];
  total: number;
  truncated: boolean;
};

function groupFitment(fitment: FitmentRange[]): { code: string; family: string | null; years: string }[] {
  const byCode = new Map<string, { family: string | null; spans: [number, number][] }>();
  for (const f of fitment) {
    const e = byCode.get(f.model_code) ?? { family: f.model_family, spans: [] };
    e.spans.push([f.year_start, f.year_end]);
    byCode.set(f.model_code, e);
  }
  return [...byCode.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, e]) => ({
    code,
    family: e.family,
    years: e.spans
      .sort((a, b) => a[0] - b[0])
      .map(([ys, ye]) => (ys === ye ? `${ys}` : `${ys}–${ye}`))
      .join(", "),
  }));
}

function catalogLabel(source: string | null): string {
  if (!source) return "";
  return source.replace(/_parts\.json$/, "").replace(/^softail_/, "Softail ").replace(/^touring$/, "Touring");
}

// Distinct exploded-view diagrams referenced by a part's occurrences.
function diagramsFor(r: CatalogResult) {
  const seen = new Set<string>();
  const out: { url: string; component: string | null; source: string | null; page: number | null }[] = [];
  for (const o of r.occurrences) {
    if (!o.diagram_url || seen.has(o.diagram_url)) continue;
    seen.add(o.diagram_url);
    out.push({ url: o.diagram_url, component: o.component, source: o.source_catalog, page: o.diagram_page ?? o.page });
  }
  return out;
}

const YEAR_MIN = 1991;
const YEAR_MAX = 2026;

export function CatalogSearch({ modelCodes }: { modelCodes: string[] }) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CatalogResult | null>(null);

  const reqId = useRef(0);

  const run = useCallback(async (qv: string, modelv: string, yearv: string) => {
    if (!qv.trim() && !modelv && !yearv) {
      setData(null);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (qv.trim()) params.set("q", qv.trim());
    if (modelv) params.set("model", modelv);
    if (yearv) params.set("year", yearv);
    try {
      const res = await fetch(`/api/catalog/search?${params.toString()}`);
      const json = (await res.json()) as SearchResponse;
      if (id === reqId.current) setData(json);
    } catch {
      if (id === reqId.current) setData({ results: [], total: 0, truncated: false });
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => run(q, model, year), 180);
    return () => clearTimeout(t);
  }, [q, model, year, run]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const results = data?.results ?? [];
  const idle = !q.trim() && !model && !year;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0 14px",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Part number, description, or component…"
          autoComplete="off"
          autoFocus
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            color: "var(--ink)",
            fontSize: 15,
            padding: "12px 10px",
            fontFamily: "var(--font-mono)",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle}>
          <option value="">All models</option>
          {modelCodes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>fits year</span>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="e.g. 2005"
          min={YEAR_MIN}
          max={YEAR_MAX}
          style={{ ...selectStyle, width: 92, fontFamily: "var(--font-mono)" }}
        />
        {(model || year || q) && (
          <button
            onClick={() => {
              setQ("");
              setModel("");
              setYear("");
            }}
            style={{ ...selectStyle, cursor: "pointer", color: "var(--ink-dim)" }}
          >
            Clear
          </button>
        )}
      </div>

      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-dim)",
          fontFamily: "var(--font-mono)",
          margin: "18px 0 12px",
          minHeight: 16,
        }}
      >
        {loading
          ? "searching…"
          : data
          ? `${data.total.toLocaleString()} result${data.total === 1 ? "" : "s"}${
              data.truncated ? ` · showing first ${results.length}` : ""
            }`
          : ""}
      </div>

      {idle && !data && (
        <div style={emptyStyle}>Start typing a part number, description, or component name.</div>
      )}
      {data && results.length === 0 && !loading && <div style={emptyStyle}>No parts match that search.</div>}

      <div>
        {results.map((r) => {
          const hasDiagram = r.occurrences.some((o) => o.diagram_url);
          return (
            <div
              key={r.part_no_normalized}
              onClick={() => setSelected(r)}
              style={{
                display: "flex",
                gap: 18,
                padding: "12px",
                borderRadius: 7,
                cursor: "pointer",
                border: "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--panel)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--tag-yellow)",
                  width: 120,
                  flexShrink: 0,
                }}
              >
                {r.part_no}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ellipsis}>{r.description || "—"}</div>
                <div style={{ ...ellipsis, fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
                  {r.component || ""}
                  {r.occurrences.length > 1 ? ` +${r.occurrences.length - 1} more` : ""}
                </div>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: "var(--ink-dim)",
                  alignSelf: "center",
                  whiteSpace: "nowrap",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                {hasDiagram && <span title="Has exploded-view diagram">▦</span>}
                {r.model_count} model{r.model_count === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>

      {selected && <PartModal result={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PartModal({ result, onClose }: { result: CatalogResult; onClose: () => void }) {
  const fits = groupFitment(result.fitment);
  const diagrams = diagramsFor(result);
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
        overflowY: "auto",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          width: "min(860px, 100%)",
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--bg)",
            borderRadius: "10px 10px 0 0",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 17, color: "var(--tag-yellow)" }}>
              {result.part_no}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 3 }}>{result.description || "—"}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              color: "var(--ink-dim)",
              borderRadius: 6,
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            Close ✕
          </button>
        </div>

        <div style={{ padding: "18px 20px 24px" }}>
          {diagrams.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={sectionLabel}>
                {diagrams.length === 1 ? "Parts-page diagram" : `Parts-page diagrams (${diagrams.length})`}
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                {diagrams.map((d) => (
                  <figure key={d.url} style={{ margin: 0 }}>
                    <img
                      src={d.url}
                      alt={d.component ?? "parts diagram"}
                      loading="lazy"
                      onClick={() => setZoom(d.url)}
                      onError={(e) => {
                        const fig = (e.currentTarget.closest("figure") as HTMLElement) || null;
                        if (fig) fig.style.display = "none";
                      }}
                      style={{
                        width: "100%",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        background: "#fff",
                        cursor: "zoom-in",
                        display: "block",
                      }}
                    />
                    <figcaption
                      style={{ fontSize: 11.5, color: "var(--ink-dim)", marginTop: 6, fontFamily: "var(--font-mono)" }}
                    >
                      {d.component || "—"} · {catalogLabel(d.source)}
                      {d.page != null ? ` · p.${d.page}` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          <div style={sectionLabel}>Fits {fits.length > 0 ? `(${fits.length} model${fits.length === 1 ? "" : "s"})` : ""}</div>
          {fits.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 7, columnGap: 14, marginBottom: 22 }}>
              {fits.map((f) => (
                <div key={f.code} style={{ display: "contents" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
                    {f.code}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--tag-green)" }}>
                    {f.years}
                    {f.family ? <span style={{ color: "var(--ink-dim)" }}> · {f.family}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 22 }}>
              No model/year fitment recorded for this part.
            </div>
          )}

          <div style={sectionLabel}>Appears in ({result.occurrences.length})</div>
          <div style={{ display: "grid", gap: 7 }}>
            {result.occurrences.map((o, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.45 }}>
                <span style={{ color: "var(--ink)" }}>{o.description || "—"}</span>
                <span style={{ color: "var(--ink-dim)" }}>
                  {" · "}
                  {o.component || "—"}
                  {o.page != null ? ` · p.${o.page}` : ""}
                  {" · "}
                  {catalogLabel(o.source_catalog)}
                  {o.international ? " · international" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {zoom && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setZoom(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            cursor: "zoom-out",
            zIndex: 200,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" style={{ maxWidth: "100%", maxHeight: "100%", background: "#fff", borderRadius: 6 }} />
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--ink)",
  fontSize: 13,
  padding: "7px 10px",
  borderRadius: 6,
  fontFamily: "var(--font-sans)",
};

const ellipsis: React.CSSProperties = {
  fontSize: 14,
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "56px 20px",
  color: "var(--ink-dim)",
  fontSize: 14,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ink-dim)",
  marginBottom: 8,
  fontFamily: "var(--font-mono)",
};
