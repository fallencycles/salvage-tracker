import Link from "next/link";
import { notFound } from "next/navigation";
import { getBillOfSale } from "@/lib/billsOfSale";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  borderBottom: "1px solid var(--border, #333)",
  padding: "8px 0",
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={row}>
      <span style={{ color: "var(--ink-dim)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function BillOfSalePage({ params }: { params: Promise<{ id: string }> }) {
  const idNum = Number((await params).id);
  if (!Number.isInteger(idNum) || idNum <= 0) notFound();

  const record = await getBillOfSale(idNum);
  if (!record) notFound();

  const saleDate = record.sale_date
    ? new Date(record.sale_date).toLocaleDateString("en-US", { timeZone: "UTC" })
    : null;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link href="/engine-sales" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
          ← Engine Sales
        </Link>
        <PrintButton />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 22, textAlign: "center", marginBottom: 4 }}>Bill of Sale</h1>
        <p style={{ textAlign: "center", color: "var(--ink-dim)", marginTop: 0, marginBottom: 24 }}>
          Fallen Cycles — Record #{record.id}
        </p>

        <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-dim)" }}>
          Customer
        </h2>
        <Row label="Sale date" value={saleDate} />
        <Row label="Customer name" value={record.customer_name} />
        <Row label="Address" value={record.customer_address} />
        <Row label="Contact" value={record.customer_contact} />

        <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-dim)", marginTop: 24 }}>
          Item
        </h2>
        <Row label="Description" value={record.item_description} />
        <Row label="VIN" value={record.vin} />
        <Row label="Serial number" value={record.serial_number} />
        <Row label="Mileage" value={record.mileage} />

        <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-dim)", marginTop: 24 }}>
          Payment
        </h2>
        <Row label="Item price" value={record.item_price != null ? `$${Number(record.item_price).toFixed(2)}` : null} />
        <Row label="Shipping" value={record.shipping != null ? `$${Number(record.shipping).toFixed(2)}` : null} />
        <Row label="Sales tax" value={record.sales_tax != null ? `$${Number(record.sales_tax).toFixed(2)}` : null} />
        <div style={{ ...row, fontWeight: 700, fontSize: 16 }}>
          <span>Total</span>
          <span>{record.total != null ? `$${Number(record.total).toFixed(2)}` : "—"}</span>
        </div>

        <div style={{ marginTop: 48, display: "flex", gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid var(--ink-dim)", marginTop: 32, paddingTop: 4, fontSize: 12, color: "var(--ink-dim)" }}>
              Seller signature
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid var(--ink-dim)", marginTop: 32, paddingTop: 4, fontSize: 12, color: "var(--ink-dim)" }}>
              Buyer signature
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
