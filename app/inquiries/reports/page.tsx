import Link from "next/link";
import { getInquiryStats } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

const tile: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 18,
};
const tileNum: React.CSSProperties = {
  fontSize: 32,
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
};
const tileLabel: React.CSSProperties = { color: "var(--ink-dim)", fontSize: 13, marginTop: 4 };

export default async function InquiryReportsPage() {
  const stats = await getInquiryStats();

  return (
    <div>
      <Link href="/inquiries" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
        ← Dashboard
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>Inquiry reports</h1>
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
          ↓ Download full CSV
        </a>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 24 }}>
        A snapshot of the inquiry log. For anything beyond this, the CSV has every call and every
        part line.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 32 }}>
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
        <div style={tile}>
          <div style={tileNum}>{stats.openPartsCount}</div>
          <div style={tileLabel}>Parts on open calls</div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Most requested parts</h2>
      {stats.topParts.length === 0 ? (
        <p style={{ color: "var(--ink-dim)" }}>Nothing logged yet.</p>
      ) : (
        <table className="board-table">
          <thead>
            <tr>
              <th>Part</th>
              <th style={{ textAlign: "right" }}>Times requested</th>
            </tr>
          </thead>
          <tbody>
            {stats.topParts.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
