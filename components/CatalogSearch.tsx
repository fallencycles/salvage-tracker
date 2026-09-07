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
  index_no: string | null;
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

// "softail_2006_parts.json" -> "softail_2006" (the catalog slug the diagram
// image + parts-list lookups are keyed by).
function catalogSlug(source: string | null): string {
  return (source ?? "").replace(/_parts\.json$/, "");
}

function catalogLabel(source: string | null): string {
  if (!source) return "";
  return catalogSlug(source).replace(/^softail_/, "Softail ").replace(/^touring$/, "Touring");
}

type DiagramRef = {
  url: string;
  component: string | null;
  source: string | null;
  page: number | null;
  // Callout numbers for THIS part on THIS diagram (catalog_part.index_no).
  callouts: string[];
};

// One row of a diagram's full parts list (GET /api/catalog/diagram).
type DiagramPart = {
  index_no: string | null;
  part_no: string;
  part_no_normalized: string;
  description: string | null;
  page: number | null;
};

const byCalloutNo = (a: string, b: string) => {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
};

// Distinct exploded-view diagrams referenced by a part's occurrences, each with
// the callout number(s) that mark this part on the drawing.
//
// NOTE / possible future work: we only have the callout *number* (index_no), not
// where it sits on the diagram image, so we surface the number and let the user
// find it. A drawn highlight (ring/box on the image) would need per-part pixel
// coordinates per diagram — manual annotation or OCR of the callout labels.
function diagramsFor(r: CatalogResult): DiagramRef[] {
  const byUrl = new Map<string, DiagramRef>();
  for (const o of r.occurrences) {
    if (!o.diagram_url) continue;
    let d = byUrl.get(o.diagram_url);
    if (!d) {
      d = {
        url: o.diagram_url,
        component: o.component,
        source: o.source_catalog,
        page: o.diagram_page ?? o.page,
        callouts: [],
      };
      byUrl.set(o.diagram_url, d);
    }
    if (o.index_no && !d.callouts.includes(o.index_no)) d.callouts.push(o.index_no);
  }
  const out = [...byUrl.values()];
  for (const d of out) d.callouts.sort(byCalloutNo);
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
  // Modal navigation stack: [] closed, last entry is the visible part. Pivoting
  // from a diagram's parts list pushes; "Back" pops.
  const [stack, setStack] = useState<CatalogResult[]>([]);
  const selected = stack[stack.length - 1] ?? null;

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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setStack([]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Open a part by number (from a diagram's parts list). Reuses the search
  // endpoint — exact part-number matches sort first — and pushes onto the stack.
  const openPartByNo = useCallback(async (partNo: string) => {
    try {
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(partNo)}`);
      const json = (await res.json()) as SearchResponse;
      const hit =
        json.results?.find((r) => r.part_no === partNo) ??
        json.results?.[0] ??
        null;
      if (hit) setStack((s) => [...s, hit]);
    } catch {
      /* ignore — the modal just stays put */
    }
  }, []);

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
              onClick={() => setStack([r])}
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

      {selected && (
        <PartModal
          key={selected.part_no_normalized}
          result={selected}
          canBack={stack.length > 1}
          onBack={() => setStack((s) => s.slice(0, -1))}
          onOpenPart={openPartByNo}
          onClose={() => setStack([])}
        />
      )}
    </div>
  );
}

// Small circular callout marker, matching the numbers printed on the diagrams.
function CalloutBadge({ n, size = 20 }: { n: string; size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: size,
        height: size,
        padding: "0 5px",
        borderRadius: 999,
        background: "var(--tag-yellow)",
        color: "#000",
        fontFamily: "var(--font-mono)",
        fontSize: Math.round(size * 0.62),
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
      }}
    >
      {n}
    </span>
  );
}

function PartModal({
  result,
  onClose,
  onBack,
  canBack,
  onOpenPart,
}: {
  result: CatalogResult;
  onClose: () => void;
  onBack: () => void;
  canBack: boolean;
  onOpenPart: (partNo: string) => void;
}) {
  const fits = groupFitment(result.fitment);
  const diagrams = diagramsFor(result);
  const [zoom, setZoom] = useState<DiagramRef | null>(null);
  const anyCallouts = diagrams.some((d) => d.callouts.length > 0);

  // Full parts list for the open diagram (its other callout numbers), fetched
  // once per (catalog, component) and cached for the life of the modal.
  const legendCache = useRef<Map<string, DiagramPart[]>>(new Map());
  const [legend, setLegend] = useState<DiagramPart[] | null>(null);
  const [legendLoading, setLegendLoading] = useState(false);
  const [legendFilter, setLegendFilter] = useState("");

  useEffect(() => {
    if (!zoom) {
      setLegend(null);
      setLegendLoading(false);
      setLegendFilter("");
      return;
    }
    const slug = catalogSlug(zoom.source);
    const key = `${slug}|${zoom.component ?? ""}`;
    const cached = legendCache.current.get(key);
    if (cached) {
      setLegend(cached);
      return;
    }
    let cancelled = false;
    setLegend(null);
    setLegendLoading(true);
    const params = new URLSearchParams({ catalog: slug, component: zoom.component ?? "" });
    fetch(`/api/catalog/diagram?${params.toString()}`)
      .then((r) => r.json())
      .then((j: { parts?: DiagramPart[] }) => {
        if (cancelled) return;
        const parts = j.parts ?? [];
        legendCache.current.set(key, parts);
        setLegend(parts);
      })
      .catch(() => {
        if (!cancelled) setLegend([]);
      })
      .finally(() => {
        if (!cancelled) setLegendLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zoom]);

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
            {canBack && (
              <button
                onClick={onBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-dim)",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                  marginBottom: 4,
                }}
              >
                ‹ Back
              </button>
            )}
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
              <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 10 }}>
                {anyCallouts
                  ? "Circled number marks this part on the drawing. Click a thumbnail to enlarge."
                  : "Click a thumbnail to enlarge."}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {diagrams.map((d) => (
                  <figure key={d.url} style={{ margin: 0, width: 156 }}>
                    <div style={{ position: "relative" }}>
                      <img
                        src={d.url}
                        alt={d.component ?? "parts diagram"}
                        loading="lazy"
                        onClick={() => setZoom(d)}
                        onError={(e) => {
                          const fig = (e.currentTarget.closest("figure") as HTMLElement) || null;
                          if (fig) fig.style.display = "none";
                        }}
                        style={{
                          width: "100%",
                          height: 118,
                          objectFit: "contain",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          background: "#fff",
                          cursor: "zoom-in",
                          display: "block",
                        }}
                      />
                      {d.callouts.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: 4,
                            left: 4,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 3,
                            maxWidth: "calc(100% - 8px)",
                          }}
                        >
                          {d.callouts.slice(0, 4).map((c) => (
                            <CalloutBadge key={c} n={c} size={18} />
                          ))}
                          {d.callouts.length > 4 && (
                            <span style={{ fontSize: 10, color: "var(--ink-dim)", alignSelf: "center" }}>
                              +{d.callouts.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <figcaption
                      style={{
                        fontSize: 11,
                        color: "var(--ink-dim)",
                        marginTop: 5,
                        fontFamily: "var(--font-mono)",
                        lineHeight: 1.35,
                      }}
                    >
                      {d.component || "—"}
                      <br />
                      {catalogLabel(d.source)}
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
                {o.index_no ? (
                  <span style={{ marginRight: 7 }}>
                    <CalloutBadge n={o.index_no} size={17} />
                  </span>
                ) : null}
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
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            cursor: "zoom-out",
            zIndex: 200,
          }}
        >
          {zoom.callouts.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
                color: "#fff",
                fontSize: 13,
              }}
            >
              <span>This part is</span>
              {zoom.callouts.map((c) => (
                <CalloutBadge key={c} n={c} size={22} />
              ))}
              <span>on the drawing</span>
            </div>
          )}

          <div
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              display: "flex",
              gap: 14,
              justifyContent: "center",
              alignItems: "flex-start",
              flexWrap: "wrap",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoom.url}
              alt={zoom.component ?? ""}
              onClick={(e) => {
                e.stopPropagation();
                setZoom(null);
              }}
              style={{
                maxWidth: "min(100%, 900px)",
                maxHeight: "100%",
                objectFit: "contain",
                background: "#fff",
                borderRadius: 6,
                cursor: "zoom-out",
              }}
            />

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 320,
                maxWidth: "100%",
                maxHeight: "100%",
                cursor: "default",
                display: "flex",
                flexDirection: "column",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                <div style={sectionLabel}>Parts on this drawing</div>
                <input
                  value={legendFilter}
                  onChange={(e) => setLegendFilter(e.target.value)}
                  placeholder="Filter by number or name…"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    marginTop: 6,
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--ink)",
                    fontSize: 12.5,
                    padding: "6px 8px",
                    outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
              <div style={{ overflowY: "auto", padding: "4px 0" }}>
                {legendLoading && (
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                    loading…
                  </div>
                )}
                {legend &&
                  !legendLoading &&
                  (() => {
                    const f = legendFilter.trim().toLowerCase();
                    const rows = f
                      ? legend.filter((p) => {
                          const idx = (p.index_no ?? "").toLowerCase();
                          return (
                            idx === f ||
                            idx.startsWith(f) ||
                            p.part_no.toLowerCase().includes(f) ||
                            (p.description ?? "").toLowerCase().includes(f)
                          );
                        })
                      : legend;
                    if (rows.length === 0) {
                      return (
                        <div
                          style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}
                        >
                          {legend.length === 0 ? "No parts list for this drawing." : "No match."}
                        </div>
                      );
                    }
                    return rows.map((p) => {
                      const mine = p.part_no_normalized === result.part_no_normalized;
                      return (
                        <button
                          key={`${p.index_no ?? ""}|${p.part_no_normalized}`}
                          onClick={mine ? undefined : () => onOpenPart(p.part_no)}
                          disabled={mine}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            padding: "6px 12px",
                            background: mine ? "var(--panel)" : "transparent",
                            border: "none",
                            borderLeft: `2px solid ${mine ? "var(--tag-yellow)" : "transparent"}`,
                            cursor: mine ? "default" : "pointer",
                          }}
                          onMouseEnter={(e) => {
                            if (!mine) e.currentTarget.style.background = "var(--panel)";
                          }}
                          onMouseLeave={(e) => {
                            if (!mine) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span style={{ flexShrink: 0, width: 24, display: "flex", justifyContent: "center" }}>
                            {p.index_no ? (
                              <CalloutBadge n={p.index_no} size={18} />
                            ) : (
                              <span style={{ color: "var(--ink-dim)", fontSize: 11 }}>—</span>
                            )}
                          </span>
                          <span
                            style={{
                              flexShrink: 0,
                              width: 80,
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--tag-yellow)",
                            }}
                          >
                            {p.part_no}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 12,
                              color: "var(--ink-dim)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.description || "—"}
                          </span>
                        </button>
                      );
                    });
                  })()}
              </div>
            </div>
          </div>

          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
            Click the image or press Esc to close · pick a row to jump to that part
          </div>
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
