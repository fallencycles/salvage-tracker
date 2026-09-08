"use client";

// Visual "part evolution" timeline for a set of search results. Each part number
// gets a row; its fitment years render as horizontal bars, coloured by model
// family. Sorting by first year makes supersessions read as a staircase
// (e.g. one derby cover 1999–2004, the next 2005–2010, …).

type FitmentRange = {
  model_code: string;
  model_family: string | null;
  model_name: string | null;
  year_start: number;
  year_end: number;
};

export type TimelinePart = {
  part_no: string;
  part_no_normalized: string;
  description: string | null;
  component: string | null;
  families: string[];
  fitment: FitmentRange[];
};

const AXIS_MIN = 1991;
const AXIS_MAX = 2026;
const SPAN = AXIS_MAX - AXIS_MIN + 1;
const TICKS = [1991, 1995, 2000, 2005, 2010, 2015, 2020, 2026];

const FAMILY_COLOR: Record<string, string> = {
  Touring: "var(--tag-blue)",
  Softail: "var(--tag-green)",
  Dyna: "var(--tag-yellow)",
  "V-Rod": "var(--tag-rust)",
  Sportster: "#9b7cb8",
  Trike: "#7fae9c",
};
const familyColor = (f: string | null) => (f && FAMILY_COLOR[f]) || "var(--ink-dim)";

const pct = (year: number) => ((year - AXIS_MIN) / SPAN) * 100;

// Merge a part's fitment rows into one contiguous span list per family.
function familySpans(fitment: FitmentRange[]) {
  const byFam = new Map<string, [number, number][]>();
  for (const f of fitment) {
    const fam = f.model_family ?? "Other";
    const list = byFam.get(fam) ?? [];
    list.push([Math.max(f.year_start, AXIS_MIN), Math.min(f.year_end, AXIS_MAX)]);
    byFam.set(fam, list);
  }
  const out: { family: string; start: number; end: number }[] = [];
  for (const [family, spansRaw] of byFam) {
    const spans = spansRaw.filter(([s, e]) => e >= s).sort((a, b) => a[0] - b[0]);
    let cur: [number, number] | null = null;
    for (const [s, e] of spans) {
      if (cur && s <= cur[1] + 1) cur[1] = Math.max(cur[1], e);
      else {
        if (cur) out.push({ family, start: cur[0], end: cur[1] });
        cur = [s, e];
      }
    }
    if (cur) out.push({ family, start: cur[0], end: cur[1] });
  }
  return out;
}

function firstYear(fitment: FitmentRange[]) {
  return fitment.reduce((m, f) => Math.min(m, f.year_start), AXIS_MAX);
}

export function CatalogTimeline({
  results,
  onOpen,
}: {
  results: TimelinePart[];
  onOpen: (r: TimelinePart) => void;
}) {
  const rows = results
    .filter((r) => r.fitment.length > 0)
    .map((r) => ({ r, spans: familySpans(r.fitment), y0: firstYear(r.fitment) }))
    .sort((a, b) => a.y0 - b.y0 || a.r.part_no.localeCompare(b.r.part_no));

  const withoutFitment = results.length - rows.length;
  const familiesShown = [...new Set(rows.flatMap((row) => row.spans.map((s) => s.family)))];

  if (rows.length === 0) {
    return (
      <div style={{ color: "var(--ink-dim)", fontSize: 13, padding: "24px 4px" }}>
        None of these parts have model/year fitment to plot.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        {familiesShown.map((f) => (
          <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-dim)" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: familyColor(f), display: "inline-block" }} />
            {f}
          </span>
        ))}
      </div>

      <div className="cat-tl">
        {/* axis */}
        <div className="cat-tl-row cat-tl-axis">
          <div className="cat-tl-label" />
          <div className="cat-tl-track">
            {TICKS.map((t) => (
              <div key={t} className="cat-tl-tick" style={{ left: `${pct(t)}%` }}>
                <span>{`'${String(t).slice(2)}`}</span>
              </div>
            ))}
          </div>
        </div>

        {rows.map(({ r, spans }) => (
          <button key={r.part_no_normalized} className="cat-tl-row cat-tl-part" onClick={() => onOpen(r)}>
            <div className="cat-tl-label">
              <span className="cat-tl-no">{r.part_no}</span>
              <span className="cat-tl-desc">{r.description || r.component || "—"}</span>
            </div>
            <div className="cat-tl-track">
              {TICKS.map((t) => (
                <div key={t} className="cat-tl-grid" style={{ left: `${pct(t)}%` }} />
              ))}
              {spans.map((s, i) => {
                const left = pct(s.start);
                const width = Math.max(pct(s.end + 1) - left, 1.2);
                return (
                  <div
                    key={i}
                    className="cat-tl-bar"
                    title={`${s.family} · ${s.start === s.end ? s.start : `${s.start}–${s.end}`}`}
                    style={{ left: `${left}%`, width: `${width}%`, background: familyColor(s.family) }}
                  />
                );
              })}
            </div>
          </button>
        ))}
      </div>

      {withoutFitment > 0 && (
        <div style={{ color: "var(--ink-dim)", fontSize: 11.5, marginTop: 10 }}>
          {withoutFitment} more result{withoutFitment === 1 ? "" : "s"} with no recorded fitment (not plotted).
        </div>
      )}
    </div>
  );
}
