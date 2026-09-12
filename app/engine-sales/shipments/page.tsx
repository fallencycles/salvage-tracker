import Link from "next/link";
import { listShipments, searchShipments, getShipmentDashboardStats } from "@/lib/bolShipments";
import { BentoGrid, BentoCard, BentoCardTitle, BentoCardLabel } from "@/components/Bento";

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

const STATUS_COLOR: Record<string, string> = {
  quoted: "var(--ink-dim)",
  booked: "var(--tag-blue, #4a90d9)",
  picked_up: "var(--tag-yellow)",
  invoiced: "var(--tag-yellow)",
  reconciled: "var(--tag-green, #4a9d6a)",
};

export default async function EngineSalesShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const status = one(sp.status);
  const filtering = !!(q || status);

  const [rows, stats] = await Promise.all([
    q ? searchShipments(q) : listShipments({ status: status || undefined, limit: 200 }),
    getShipmentDashboardStats(),
  ]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Engine Sales — Shipments</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/engine-sales/reports" style={secondaryBtn}>
            Reports
          </Link>
          <Link href="/engine-sales/shipments/new" style={primaryBtn}>
            + New shipment
          </Link>
        </div>
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Every engine sale moving through freight — quote to pickup to invoice.
      </p>

      <div style={{ marginBottom: 24 }}>
        <BentoGrid columns={6}>
          <BentoCard>
            <BentoCardTitle style={{ color: "var(--tag-yellow)" }}>{stats.inTransitCount}</BentoCardTitle>
            <BentoCardLabel>In transit</BentoCardLabel>
          </BentoCard>
          <BentoCard>
            <BentoCardTitle>{stats.openInvoiceCount}</BentoCardTitle>
            <BentoCardLabel>Open invoices (${stats.openInvoiceTotal.toFixed(0)})</BentoCardLabel>
          </BentoCard>
          <BentoCard>
            <BentoCardTitle>{stats.awaitingBolCount}</BentoCardTitle>
            <BentoCardLabel>Quoted, awaiting BOL</BentoCardLabel>
          </BentoCard>
          <BentoCard>
            <BentoCardTitle style={{ color: stats.overduePickupCount > 0 ? "var(--tag-rust)" : undefined }}>
              {stats.overduePickupCount}
            </BentoCardTitle>
            <BentoCardLabel>Overdue for pickup</BentoCardLabel>
          </BentoCard>
          <BentoCard>
            <BentoCardTitle style={{ color: stats.flaggedReconciliationCount > 0 ? "var(--tag-rust)" : undefined }}>
              {stats.flaggedReconciliationCount}
            </BentoCardTitle>
            <BentoCardLabel>Reconciliation flags</BentoCardLabel>
          </BentoCard>
          <BentoCard>
            <BentoCardTitle>{stats.shipmentsThisWeek}</BentoCardTitle>
            <BentoCardLabel>New this week</BentoCardLabel>
          </BentoCard>
        </BentoGrid>
      </div>

      <form
        method="get"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 160px auto auto",
          gap: 8,
          alignItems: "center",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          marginBottom: 24,
        }}
      >
        <input name="q" defaultValue={q} placeholder="Customer, stock #, BOL #, PRO #" style={filterInput} />
        <select name="status" defaultValue={status} style={filterInput}>
          <option value="">Any status</option>
          <option value="quoted">Quoted</option>
          <option value="booked">Booked</option>
          <option value="picked_up">Picked up</option>
          <option value="invoiced">Invoiced</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <button type="submit" style={primaryBtn}>
          Search
        </button>
        {filtering ? (
          <Link href="/engine-sales/shipments" style={ghostLink}>
            Clear
          </Link>
        ) : (
          <span />
        )}
      </form>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
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
          <span style={{ fontWeight: 600, fontSize: 14 }}>Shipments</span>
          <span style={{ color: "var(--ink-dim)", fontSize: 13 }}>
            {filtering ? `${rows.length} match${rows.length === 1 ? "" : "es"}` : rows.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-dim)", padding: 16, margin: 0 }}>No shipments yet.</p>
        ) : (
          <table className="board-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Created</th>
                <th>Customer</th>
                <th>Stock #</th>
                <th>Carrier</th>
                <th>BOL / PRO #</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <Link href={`/engine-sales/shipments/${s.id}`}>{s.customer_name ?? `#${s.id}`}</Link>
                  </td>
                  <td>{s.stock_number ?? "—"}</td>
                  <td>{s.carrier ?? "—"}</td>
                  <td>
                    {s.bol_number ?? "—"}
                    {s.pro_number ? ` / ${s.pro_number}` : ""}
                  </td>
                  <td>
                    <span className="status-pill" style={{ color: STATUS_COLOR[s.status] }}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
