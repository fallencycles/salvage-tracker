import Link from "next/link";
import { InquiryForm, type ModelOption } from "@/components/InquiryForm";
import { catalogModels } from "@/lib/catalog";
import { listInquiries, searchInquiries, formatReceivedAt } from "@/lib/inquiries";

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

  const [models, rows] = await Promise.all([
    catalogModels(),
    filtering ? searchInquiries({ q, year, model }) : listInquiries(50),
  ]);

  // Unique model names for the datalists, sorted by family then name.
  const seen = new Set<string>();
  const modelOptions: ModelOption[] = [];
  for (const m of models) {
    if (!m.name || seen.has(m.name)) continue;
    seen.add(m.name);
    modelOptions.push({ name: m.name, family: m.family });
  }
  modelOptions.sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Customer inquiries</h1>
        <a
          href="/api/inquiries/export"
          style={{
            fontSize: 13,
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "7px 12px",
            textDecoration: "none",
            color: "var(--ink)",
            whiteSpace: "nowrap",
          }}
        >
          ↓ Download CSV
        </a>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Log what a customer needs while you're on the call. Contact details, the bike, and every
        part they ask about. The CSV is one row per part.
      </p>

      <InquiryForm models={modelOptions} />

      <h2 style={{ fontSize: 16, margin: "32px 0 10px" }}>Find an inquiry</h2>
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
          {modelOptions.map((m) => (
            <option key={m.name} value={m.name}>
              {m.family}
            </option>
          ))}
        </datalist>
        <button
          type="submit"
          style={{
            background: "var(--tag-yellow)",
            color: "#211f1d",
            border: "none",
            borderRadius: 4,
            padding: "9px 16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Search
        </button>
        {filtering ? (
          <Link href="/inquiries" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
            Clear
          </Link>
        ) : (
          <span />
        )}
      </form>

      <h2 style={{ fontSize: 16, margin: "24px 0 10px" }}>
        {filtering ? `Matches (${rows.length})` : `Recent inquiries (${rows.length})`}
      </h2>
      {rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)" }}>
          {filtering ? "No inquiries match that search." : "Nothing logged yet."}
        </p>
      ) : (
        <table className="board-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Customer</th>
              <th>Motorcycle</th>
              <th>Parts</th>
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
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {p.oem_part_number ?? "?"}
                          </span>
                          {p.description ? ` — ${p.description}` : ""}
                          {p.qty ? ` ×${p.qty}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <Link
                    href={`/inquiries/${inq.id}`}
                    style={{ fontSize: 13, color: "var(--tag-blue)", textDecoration: "none" }}
                  >
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
