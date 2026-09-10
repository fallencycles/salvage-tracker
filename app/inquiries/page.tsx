import Link from "next/link";
import { catalogModels } from "@/lib/catalog";
import {
  listInquiries,
  searchInquiries,
  getInquiryStats,
  formatReceivedAt,
  type InquiryWithParts,
} from "@/lib/inquiries";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || "";

const filterInput: React.CSSProperties = {
  background: "var(--panel-raised)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 14,
  width: "100%",
};

const tile: React.CSSProperties = {
  display: "block",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 16,
  textDecoration: "none",
};
const tileNum: React.CSSProperties = {
  fontSize: 28,
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  color: "var(--ink)",
};
const tileLabel: React.CSSProperties = { color: "var(--ink-dim)", fontSize: 13, marginTop: 4 };

const primaryBtn: React.CSSProperties = {
  background: "var(--tag-yellow)",
  color: "#211f1d",
  border: "none",
  borderRadius: 4,
  padding: "10px 18px",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
  whiteSpace: "nowrap",
};
const secondaryBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  color: "var(--ink)",
  borderRadius: 4,
  padding: "10px 16px",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
  whiteSpace: "nowrap",
};
const ghostLink: React.CSSProperties = {
  fontSize: 13,
  color: "var(--ink-dim)",
  textDecoration: "none",
  alignSelf: "center",
};

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const year = one(sp.year);
  const model = one(sp.model);
  const filtering = !!(q || year || model);

  const [models, rows, stats] = await Promise.all([
    catalogModels(),
    filtering ? searchInquiries({ q, year, model }) : listInquiries(200),
    getInquiryStats(),
  ]);

  const openRows = rows.filter((r) => r.status === "open");
  const closedRows = rows.filter((r) => r.status !== "open");

  // Suggestions for the search-filter datalist: name and code, deduped.
  const filterModelOpts: { value: string; hint: string }[] = [];
  const seenFilter = new Set<string>();
  for (const m of models) {
    for (const v of [m.name, m.code]) {
      if (!v || seenFilter.has(v)) continue;
      seenFilter.add(v);
      filterModelOpts.push({ value: v, hint: m.name && v === m.code ? `${m.family} · ${m.name}` : m.family });
    }
  }
  filterModelOpts.sort((a, b) => a.value.localeCompare(b.value));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Customer inquiries</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/api/inquiries/export" style={ghostLink}>
            ↓ CSV
          </a>
          <Link href="/inquiries/reports" style={secondaryBtn}>
            Run reports
          </Link>
          <Link href="/inquiries/new" style={primaryBtn}>
            + New inquiry
          </Link>
        </div>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        What customers have called about, the bikes they're working on, and what they need.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={tile}>
          <div style={{ ...tileNum, color: "var(--tag-yellow)" }}>{stats.openCount}</div>
          <div style={tileLabel}>Open</div>
        </div>
        <div style={tile}>
          <div style={tileNum}>{stats.closedCount}</div>
          <div style={tileLabel}>Closed</div>
        </div>
        <div style={tile}>
          <div style={tileNum}>{stats.totalCount}</div>
          <div style={tileLabel}>Total logged</div>
        </div>
        <div style={tile}>
          <div style={tileNum}>{stats.loggedLast7Days}</div>
          <div style={tileLabel}>Logged last 7 days</div>
        </div>
      </div>

      <form
        method="get"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 100px 1fr auto auto",
          gap: 8,
          alignItems: "center",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 24,
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Customer name or part (number / description)"
          style={filterInput}
        />
        <input name="year" defaultValue={year} placeholder="Year" inputMode="numeric" style={filterInput} />
        <input name="model" defaultValue={model} placeholder="Model" list="filter-models" style={filterInput} />
        <datalist id="filter-models">
          {filterModelOpts.map((m) => (
            <option key={m.value} value={m.value}>
              {m.hint}
            </option>
          ))}
        </datalist>
        <button type="submit" style={primaryBtn}>
          Search
        </button>
        {filtering ? (
          <Link href="/inquiries" style={ghostLink}>
            Clear
          </Link>
        ) : (
          <span />
        )}
      </form>

      <InquirySection
        title="Open"
        accent="var(--tag-yellow)"
        rows={openRows}
        filtering={filtering}
        emptyLabel="No open inquiries."
      />
      <InquirySection
        title="Closed"
        accent="var(--ink-dim)"
        rows={closedRows}
        filtering={filtering}
        emptyLabel="No closed inquiries."
      />
    </div>
  );
}

function InquirySection({
  title,
  accent,
  rows,
  filtering,
  emptyLabel,
}: {
  title: string;
  accent: string;
  rows: InquiryWithParts[];
  filtering: boolean;
  emptyLabel: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderTop: `3px solid ${accent}`,
        borderRadius: 6,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        <span style={{ color: "var(--ink-dim)", fontSize: 13 }}>
          {filtering ? `${rows.length} match${rows.length === 1 ? "" : "es"}` : rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)", padding: 16, margin: 0 }}>{emptyLabel}</p>
      ) : (
        <table className="board-table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Received</th>
              <th>Customer</th>
              <th>Motorcycle</th>
              <th>Parts</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inq) => (
              <tr key={inq.id}>
                <td style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {formatReceivedAt(inq.created_at)}
                </td>
                <td>
                  <div>{inq.customer_name ?? "—"}</div>
                  <div style={{ color: "var(--ink-dim)", fontSize: 12 }}>
                    {[inq.phone, inq.company].filter(Boolean).join(" · ") || " "}
                  </div>
                </td>
                <td style={{ fontSize: 13 }}>
                  {[inq.moto_year, inq.moto_make, inq.moto_model].filter(Boolean).join(" ") || "—"}
                </td>
                <td style={{ fontSize: 13 }}>
                  {inq.parts.length === 0 ? (
                    <span style={{ color: "var(--ink-dim)" }}>contact only</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {inq.parts.map((p) => (
                        <li key={p.id}>
                          <span style={{ fontFamily: "var(--font-mono)" }}>{p.oem_part_number ?? "?"}</span>
                          {p.description ? ` — ${p.description}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td style={{ maxWidth: 220 }}>
                  {inq.notes ? (
                    <span
                      title={inq.notes}
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        fontSize: 13,
                      }}
                    >
                      {inq.notes}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-dim)", fontSize: 13, fontStyle: "italic" }}>no notes</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <Link href={`/inquiries/${inq.id}`} style={{ fontSize: 13, color: "var(--tag-blue)", textDecoration: "none" }}>
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
