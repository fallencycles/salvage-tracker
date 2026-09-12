import Link from "next/link";
import { notFound } from "next/navigation";
import { getShipment } from "@/lib/bolShipments";
import { getReconciliationSummary } from "@/lib/bolInvoices";
import { ShipmentStatusSelect } from "@/components/ShipmentStatusSelect";

export const dynamic = "force-dynamic";

const panel: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 18,
  marginBottom: 16,
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  borderBottom: "1px solid var(--border)",
  padding: "6px 0",
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={rowStyle}>
      <span style={{ color: "var(--ink-dim)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { timeZone: "UTC" });
}
function fmtMoney(n: number | string | null | undefined) {
  if (n === null || n === undefined) return null;
  return `$${Number(n).toFixed(2)}`;
}

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const shipment = await getShipment(id);
  if (!shipment) notFound();

  const reconciliation = (await getReconciliationSummary()).find((r) => r.shipment_id === id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <Link href="/engine-sales/shipments" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
          ← Shipments
        </Link>
        <Link
          href={`/engine-sales/shipments/${id}/email`}
          style={{
            background: "var(--tag-yellow)",
            color: "#211f1d",
            border: "none",
            borderRadius: 4,
            padding: "8px 14px",
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Send tracking email
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{shipment.customer_name ?? `Shipment #${shipment.id}`}</h1>
        <ShipmentStatusSelect shipmentId={shipment.id} status={shipment.status ?? "quoted"} />
      </div>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>Case #{shipment.id}</p>

      <div style={panel}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Shipment</h2>
        <Row label="Stock number" value={shipment.stock_number} />
        <Row label="Customer email" value={shipment.customer_email} />
        <Row label="Carrier" value={shipment.carrier} />
        <Row label="Ship date" value={fmtDate(shipment.ship_date)} />
        <Row label="Freight terms" value={shipment.freight_terms} />
        <Row label="BOL number" value={shipment.bol_number} />
        <Row label="PRO number" value={shipment.pro_number} />
        <Row label="Origin terminal" value={shipment.origin_terminal} />
        <Row label="Destination terminal" value={shipment.destination_terminal} />
        <Row label="Ship from" value={[shipment.ship_from_name, shipment.ship_from_address, shipment.ship_from_contact].filter(Boolean).join(" · ")} />
        <Row label="Ship to" value={[shipment.ship_to_name, shipment.ship_to_address, shipment.ship_to_contact].filter(Boolean).join(" · ")} />
        <Row label="Special instructions" value={shipment.special_instructions} />
        <Row label="Pickup instructions" value={shipment.pickup_instructions} />
        <Row label="Delivery instructions" value={shipment.delivery_instructions} />
      </div>

      {reconciliation && (
        <div
          style={{
            ...panel,
            borderColor: reconciliation.flagged ? "var(--tag-rust)" : "var(--border)",
          }}
        >
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Reconciliation</h2>
          <Row label="Quoted" value={fmtMoney(reconciliation.quoted)} />
          <Row label="Actual (invoiced)" value={fmtMoney(reconciliation.actual)} />
          {reconciliation.variance != null && (
            <Row
              label="Variance"
              value={`${fmtMoney(reconciliation.variance)} (${reconciliation.variancePct?.toFixed(1)}%)`}
            />
          )}
          {reconciliation.flagged && (
            <p style={{ color: "var(--tag-rust)", marginTop: 8, marginBottom: 0, fontSize: 13 }}>
              {reconciliation.reason === "variance" && "Invoice doesn't match the quote — worth a second look."}
              {reconciliation.reason === "invoiced_no_quote" && "Invoiced with no quote on file for this shipment."}
              {reconciliation.reason === "stale_no_invoice" && "Quoted/shipped a while ago with no invoice matched yet."}
            </p>
          )}
        </div>
      )}

      {shipment.quotes.length > 0 && (
        <div style={panel}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Quotes</h2>
          {shipment.quotes.map((q: any) => (
            <div key={q.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              <Row label="Quote #" value={q.quote_number} />
              <Row label="Carrier / service" value={[q.carrier, q.service].filter(Boolean).join(" / ")} />
              <Row label="Estimated price" value={fmtMoney(q.estimated_price)} />
              <Row label="Valid until" value={fmtDate(q.valid_until)} />
            </div>
          ))}
        </div>
      )}

      {shipment.invoiceLines.length > 0 && (
        <div style={panel}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Invoice lines</h2>
          {shipment.invoiceLines.map((l: any) => (
            <div key={l.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              <Row label="Invoice #" value={l.invoice_number} />
              <Row label="Line total" value={fmtMoney(l.line_total)} />
              <Row label="Charges" value={fmtMoney(l.charges_total)} />
              <Row label="Payment status" value={l.payment_status} />
            </div>
          ))}
        </div>
      )}

      {shipment.billsOfSale.length > 0 && (
        <div style={panel}>
          <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Bill of sale</h2>
          {shipment.billsOfSale.map((b: any) => (
            <Row key={b.id} label={b.item_description ?? `Bill of sale #${b.id}`} value={fmtMoney(b.total)} />
          ))}
        </div>
      )}

      <div style={panel}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>Activity</h2>
        {shipment.activity.length === 0 ? (
          <p style={{ color: "var(--ink-dim)", margin: 0 }}>Nothing logged yet.</p>
        ) : (
          shipment.activity.map((a: any) => (
            <div key={a.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontWeight: 600 }}>{a.event_type.replace(/_/g, " ")}</span>
                <span style={{ color: "var(--ink-dim)", fontSize: 12 }}>
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              {a.note && <span style={{ color: "var(--ink-dim)", fontSize: 13, whiteSpace: "pre-wrap" }}>{a.note}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
