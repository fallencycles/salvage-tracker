import Link from "next/link";
import { ShipmentForm } from "@/components/ShipmentForm";

export default function NewShipmentPage() {
  return (
    <div>
      <Link href="/engine-sales/shipments" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
        ← Shipments
      </Link>
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>New shipment</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Start a bare case — useful for a phone quote with no document yet. Attach a BOL, quote,
        invoice, or bill of sale to it later from the intake tools.
      </p>
      <ShipmentForm />
    </div>
  );
}
