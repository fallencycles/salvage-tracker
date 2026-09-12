import Link from "next/link";
import { getSpendByMonth, getSpendByCarrier, getFlaggedReconciliations } from "@/lib/bolReports";
import { BentoGrid, BentoCard, BentoCardTitle, BentoCardLabel } from "@/components/Bento";

export const dynamic = "force-dynamic";

const ghostLink: React.CSSProperties = {
  fontSize: 13,
  color: "var(--ink-dim)",
  textDecoration: "none",
  alignSelf: "center",
};

export default async function EngineSalesReportsPage() {
  const [spendByMonth, spendByCarrier, flagged] = await Promise.all([
    getSpendByMonth(),
    getSpendByCarrier(),
    getFlaggedReconciliations(),
  ]);

  const thisMonthSpend = spendByMonth[0]?.total ?? 0;
  const totalFlaggedVariance = flagged.reduce((sum, r) => sum + Math.abs(r.variance ?? 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>Engine Sales — Reports</h1>
        <a href="/api/engine-sales/reports/export" style={ghostLink}>
          ↓ CSV
        </a>
      </div>
      <Link href="/engine-sales/shipments" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
        ← Shipments
      </Link>

      <div style={{ margin: "20px 0 24px" }}>
        <BentoGrid columns={3}>
          <BentoCard>
            <BentoCardTitle>${thisMonthSpend.toFixed(0)}</BentoCardTitle>
            <BentoCardLabel>Freight spend this month</BentoCardLabel>
          </BentoCard>
          <BentoCard>
            <BentoCardTitle style={{ color: flagged.length > 0 ? "var(--tag-rust)" : undefined }}>
              {flagged.length}
            </BentoCardTitle>
            <BentoCardLabel>Flagged shipments</BentoCardLabel>
          </BentoCard>
          <BentoCard>
            <BentoCardTitle>${totalFlaggedVariance.toFixed(0)}</BentoCardTitle>
            <BentoCardLabel>Total variance under review</BentoCardLabel>
          </BentoCard>
        </BentoGrid>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--panel)", fontWeight: 600, fontSize: 14 }}>
            Spend by month
          </div>
          {spendByMonth.length === 0 ? (
            <p style={{ color: "var(--ink-dim)", padding: 16, margin: 0 }}>No invoices yet.</p>
          ) : (
            <table className="board-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {spendByMonth.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>${m.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--panel)", fontWeight: 600, fontSize: 14 }}>
            Spend by carrier
          </div>
          {spendByCarrier.length === 0 ? (
            <p style={{ color: "var(--ink-dim)", padding: 16, margin: 0 }}>No invoices yet.</p>
          ) : (
            <table className="board-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Shipments</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {spendByCarrier.map((c) => (
                  <tr key={c.carrier}>
                    <td>{c.carrier}</td>
                    <td>{c.shipmentCount}</td>
                    <td>${c.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderTop: "3px solid var(--tag-rust)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--panel)", fontWeight: 600, fontSize: 14 }}>
          Quote vs. actual — worst first
        </div>
        {flagged.length === 0 ? (
          <p style={{ color: "var(--ink-dim)", padding: 16, margin: 0 }}>Nothing flagged.</p>
        ) : (
          <table className="board-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Carrier</th>
                <th>Quoted</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((r) => (
                <tr key={r.shipment_id}>
                  <td>{r.customer_name ?? "—"}</td>
                  <td>{r.carrier ?? "—"}</td>
                  <td>{r.quoted != null ? `$${r.quoted.toFixed(2)}` : "—"}</td>
                  <td>{r.actual != null ? `$${r.actual.toFixed(2)}` : "—"}</td>
                  <td>{r.variance != null ? `$${r.variance.toFixed(2)}` : "—"}</td>
                  <td>{r.reason?.replace(/_/g, " ")}</td>
                  <td>
                    <Link href={`/engine-sales/shipments/${r.shipment_id}`}>view</Link>
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
