"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FitmentRange = {
  model_code: string;
  model_family: string | null;
  model_name: string | null;
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
  families: string[];
  occurrences: CatalogOccurrence[];
  fitment: FitmentRange[];
};

type SearchResponse = {
  results: CatalogResult[];
  total: number;
  truncated: boolean;
};

const FAMILY_BUTTONS = ["Touring", "Softail", "Dyna", "FXR", "Sportster", "V-Rod", "Trike", "Other"];

function groupFitment(
  fitment: FitmentRange[]
): { code: string; family: string | null; name: string | null; years: string }[] {
  const byCode = new Map<
    string,
    { family: string | null; name: string | null; spans: [number, number][] }
  >();
  for (const f of fitment) {
    const e = byCode.get(f.model_code) ?? { family: f.model_family, name: f.model_name, spans: [] };
    if (!e.name && f.model_name) e.name = f.model_name;
    e.spans.push([f.year_start, f.year_end]);
    byCode.set(f.model_code, e);
  }
  return [...byCode.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, e]) => ({
      code,
      family: e.family,
      name: e.name,
      years: e.spans
        .sort((a, b) => a[0] - b[0])
        .map(([ys, ye]) => (ys === ye ? `${ys}` : `${ys}–${ye}`))
        .join(", "),
    }));
}

// "softail_2006_parts.json" -> "softail_2006"
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
  callouts: string[];
};

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

// A small labelled pill — used for the family filter buttons and the family
// tags on result rows.
function Pill({
  children,
  active,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={disabled}
      title={title}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        lineHeight: 1,
        padding: "6px 11px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--tag-yellow)" : "var(--border)"}`,
        background: active ? "var(--tag-yellow)" : "var(--panel)",
        color: active ? "#211f1d" : disabled ? "var(--ink-dim)" : "var(--ink)",
        fontWeight: active ? 600 : 500,
        opacity: disabled ? 0.4 : 1,
        cursor: clickable ? "pointer" : disabled ? "not-allowed" : "default",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// Static family tag (not a button) for result rows.
function FamilyTag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        lineHeight: 1,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: "var(--panel-raised)",
        color: "var(--ink-dim)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const YEAR_MIN = 1991;
const YEAR_MAX = 2026;
const ALL_YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MAX - i);

type CatalogModel = {
  code: string;
  family: string;
  name: string | null;
  year_start: number;
  year_end: number;
};

export function CatalogSearch({
  models,
  familyCounts,
}: {
  models: CatalogModel[];
  familyCounts?: Record<string, number>;
}) {
  const [q, setQ] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [family, setFamily] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState<CatalogResult[]>([]);
  const selected = stack[stack.length - 1] ?? null;

  const reqId = useRef(0);

  const run = useCallback(
    async (qv: string, modelv: string, yearv: string, familyv: string) => {
      if (!qv.trim() && !modelv && !yearv && !familyv) {
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
      if (familyv) params.set("family", familyv);
      try {
        const res = await fetch(`/api/catalog/search?${params.toString()}`);
        const json = (await res.json()) as SearchResponse;
        if (id === reqId.current) setData(json);
      } catch {
        if (id === reqId.current) setData({ results: [], total: 0, truncated: false });
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => run(q, model, year, family), 180);
    return () => clearTimeout(t);
  }, [q, model, year, family, run]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setStack([]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const openPartByNo = useCallback(async (partNo: string) => {
    try {
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(partNo)}`);
      const json = (await res.json()) as SearchResponse;
      const hit = json.results?.find((r) => r.part_no === partNo) ?? json.results?.[0] ?? null;
      if (hit) setStack((s) => [...s, hit]);
    } catch {
      /* ignore */
    }
  }, []);

  // Model dropdown: scoped to the active family, else the whole list deduped by
  // code (a few codes are reused across families). Labelled "CODE — Friendly name".
  const modelOptions = useMemo(() => {
    const scoped = family ? models.filter((m) => m.family === family) : models;
    const seen = new Set<string>();
    const out: CatalogModel[] = [];
    for (const m of scoped) {
      const key = family ? `${m.family}:${m.code}` : m.code;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
    return out.sort((a, b) =>
      (a.name ?? a.code).localeCompare(b.name ?? b.code, undefined, { sensitivity: "base" })
    );
  }, [models, family]);

  // Year dropdown: narrowed to the chosen model's span, or the family's overall
  // span, so you can't pick a year with nothing behind it.
  const yearOptions = useMemo(() => {
    const picked = models.find(
      (m) => m.code === model && (!family || m.family === family)
    );
    let lo = YEAR_MIN;
    let hi = YEAR_MAX;
    if (picked) {
      lo = picked.year_start;
      hi = picked.year_end;
    } else if (family) {
      const fam = models.filter((m) => m.family === family);
      if (fam.length) {
        lo = Math.min(...fam.map((m) => m.year_start));
        hi = Math.max(...fam.map((m) => m.year_end));
      }
    }
    return ALL_YEARS.filter((y) => y >= lo && y <= hi);
  }, [models, model, family]);

  // Drop a year that no longer fits the current model/family scope.
  useEffect(() => {
    if (year && !yearOptions.includes(Number(year))) setYear("");
  }, [yearOptions, year]);

  const results = data?.results ?? [];
  const idle = !q.trim() && !model && !year && !family;

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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ opacity: 0.5, flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Part number, description, or component…"
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 0,
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

      {/* step 1 — family */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--ink-dim)", marginRight: 2 }}>Family:</span>
        {FAMILY_BUTTONS.map((f) => {
          const count = familyCounts?.[f] ?? 0;
          const disabled = count === 0;
          const active = family === f;
          return (
            <Pill
              key={f}
              active={active}
              disabled={disabled && !active}
              title={disabled ? `No ${f} parts yet` : `${count} model codes`}
              onClick={() => {
                setFamily(active ? "" : f);
                setModel("");
              }}
            >
              {f}
            </Pill>
          );
        })}
      </div>

      {/* step 2 — model + year, both scoped to the family picked above */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-dim)" }}>
          Model
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ ...selectStyle, maxWidth: 280 }}
          >
            <option value="">{family ? `All ${family} models` : "Any model"}</option>
            {modelOptions.map((m) => (
              <option key={`${m.family}:${m.code}`} value={m.code}>
                {m.name ? `${m.code} — ${m.name}` : m.code}
                {!family ? ` (${m.family})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-dim)" }}>
          Year
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{ ...selectStyle, width: 108, fontFamily: "var(--font-mono)" }}
          >
            <option value="">Any year</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {(model || year || q || family) && (
          <button
            onClick={() => {
              setQ("");
              setModel("");
              setYear("");
              setFamily("");
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
        <div style={emptyStyle}>Pick a model above, or start typing a part number, description, or component.</div>
      )}
      {data && results.length === 0 && !loading && (
        <div style={emptyStyle}>No parts match that search.</div>
      )}

      <div>
        {results.map((r) => {
          const hasDiagram = r.occurrences.some((o) => o.diagram_url);
          return (
            <div key={r.part_no_normalized} className="cat-row" onClick={() => setStack([r])}>
              <div className="cat-row-no">{r.part_no}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ellipsis}>{r.description || "—"}</div>
                <div style={{ ...ellipsis, fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
                  {r.component || ""}
                  {r.occurrences.length > 1 ? ` +${r.occurrences.length - 1} more` : ""}
                </div>
              </div>
              <div className="cat-row-meta">
                {hasDiagram && (
                  <span title="Has exploded-view diagram" style={{ color: "var(--ink-dim)" }}>
                    ▦
                  </span>
                )}
                {r.families.map((f) => (
                  <FamilyTag key={f} label={f} />
                ))}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--ink-dim)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.model_count} model{r.model_count === 1 ? "" : "s"}
                </span>
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

const FAMILY_ORDER = ["Touring", "Softail", "Dyna", "FXR", "Sportster", "V-Rod", "Trike", "Other"];
const FAMILY_ACCENT: Record<string, string> = {
  Touring: "var(--tag-blue)",
  Softail: "var(--tag-green)",
  Dyna: "var(--tag-yellow)",
  FXR: "#c98a5b",
  "V-Rod": "var(--tag-rust)",
  Sportster: "#9b7cb8",
  Trike: "#7fae9c",
  Other: "var(--ink-dim)",
};
const familyRank = (f: string) => {
  const i = FAMILY_ORDER.indexOf(f);
  return i === -1 ? FAMILY_ORDER.length : i;
};

// "Fits" as collapsible groups, one per model family. The header shows the
// family, model count and overall year span; expanding reveals each model
// code (+ friendly name) with its year ranges.
function FitsAccordion({ fitment }: { fitment: FitmentRange[] }) {
  const rows = groupFitment(fitment); // [{ code, family, name, years }]

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.family ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const span = new Map<string, [number, number]>();
  for (const f of fitment) {
    const key = f.model_family ?? "Other";
    const cur = span.get(key);
    span.set(
      key,
      cur ? [Math.min(cur[0], f.year_start), Math.max(cur[1], f.year_end)] : [f.year_start, f.year_end]
    );
  }
  const families = [...groups.keys()].sort(
    (a, b) => familyRank(a) - familyRank(b) || a.localeCompare(b)
  );

  const [open, setOpen] = useState<Set<string>>(
    () => new Set(families.length === 1 ? families : [])
  );
  const toggle = (f: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(f) ? n.delete(f) : n.add(f);
      return n;
    });

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 22 }}>
        No model/year fitment recorded for this part.
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 22,
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {families.map((fam, i) => {
        const list = groups.get(fam)!;
        const isOpen = open.has(fam);
        const [ys, ye] = span.get(fam) ?? [0, 0];
        return (
          <div key={fam} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => toggle(fam)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: isOpen ? "var(--panel)" : "transparent",
                border: "none",
                borderLeft: `3px solid ${FAMILY_ACCENT[fam] ?? "var(--ink-dim)"}`,
                color: "var(--ink)",
                font: "inherit",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ color: "var(--ink-dim)", fontSize: 11, width: 9 }}>{isOpen ? "▾" : "▸"}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{fam}</span>
              <span style={{ fontSize: 11.5, color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                {list.length} model{list.length === 1 ? "" : "s"} · {ys === ye ? ys : `${ys}–${ye}`}
              </span>
            </button>
            {isOpen && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 210px) 1fr",
                  rowGap: 7,
                  columnGap: 12,
                  padding: "4px 14px 12px 25px",
                }}
              >
                {list.map((f) => (
                  <div key={f.code} style={{ display: "contents" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12.5,
                          color: "var(--ink)",
                          fontWeight: 600,
                        }}
                      >
                        {f.code}
                      </span>
                      {f.name && (
                        <span
                          style={{
                            fontSize: 11,
                            lineHeight: 1.1,
                            padding: "3px 7px",
                            borderRadius: 999,
                            border: "1px solid var(--border)",
                            background: "var(--panel-raised)",
                            color: "var(--ink-dim)",
                          }}
                        >
                          {f.name}
                        </span>
                      )}
                    </div>
                    <div
                      style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--tag-green)" }}
                    >
                      {f.years}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
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
    <div className="cat-modal-scrim" onClick={onClose}>
      <div className="cat-modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--bg)",
            zIndex: 1,
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
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 17,
                color: "var(--tag-yellow)",
              }}
            >
              {result.part_no}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 3 }}>
              {result.description || "—"}
            </div>
            {result.families.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {result.families.map((f) => (
                  <FamilyTag key={f} label={f} />
                ))}
              </div>
            )}
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

        <div style={{ padding: "18px" }}>
          <div style={sectionLabel}>
            Fits {fits.length > 0 ? `(${fits.length} model${fits.length === 1 ? "" : "s"})` : ""}
          </div>
          <FitsAccordion fitment={result.fitment} />

          {diagrams.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={sectionLabel}>
                {diagrams.length === 1 ? "Parts-page diagram" : `Parts-page diagrams (${diagrams.length})`}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 10 }}>
                {anyCallouts
                  ? "Circled number marks this part on the drawing. Tap a thumbnail to enlarge."
                  : "Tap a thumbnail to enlarge."}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {diagrams.map((d) => (
                  <figure key={d.url} style={{ margin: 0, width: 156, maxWidth: "100%" }}>
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
        <div className="cat-zoom" onClick={(e) => e.stopPropagation()}>
          <div className="cat-zoom-head">
            <button onClick={() => setZoom(null)} style={zoomBtn}>
              ‹ Back to part
            </button>
            {zoom.callouts.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                This part is
                {zoom.callouts.map((c) => (
                  <CalloutBadge key={c} n={c} size={20} />
                ))}
                on the drawing
              </span>
            )}
            <button onClick={() => setZoom(null)} style={{ ...zoomBtn, marginLeft: "auto" }}>
              Close ✕
            </button>
          </div>

          <div className="cat-zoom-body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cat-zoom-img"
              src={zoom.url}
              alt={zoom.component ?? ""}
              onClick={() => setZoom(null)}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />

            <div className="cat-zoom-panel" onClick={(e) => e.stopPropagation()}>
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
              <div className="cat-zoom-list">
                {legendLoading && (
                  <div
                    style={{
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "var(--ink-dim)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
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
                          style={{
                            padding: "10px 12px",
                            fontSize: 12,
                            color: "var(--ink-dim)",
                            fontFamily: "var(--font-mono)",
                          }}
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
                            padding: "8px 12px",
                            background: mine ? "var(--panel)" : "transparent",
                            border: "none",
                            borderLeft: `2px solid ${mine ? "var(--tag-yellow)" : "transparent"}`,
                            cursor: mine ? "default" : "pointer",
                          }}
                        >
                          <span
                            style={{ flexShrink: 0, width: 24, display: "flex", justifyContent: "center" }}
                          >
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
              <div
                style={{
                  padding: "8px 12px",
                  borderTop: "1px solid var(--border)",
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Pick a row to jump to that part
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const zoomBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12.5,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--ink)",
  fontSize: 13,
  padding: "8px 10px",
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
