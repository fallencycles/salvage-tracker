import Link from "next/link";
import { BillOfSaleForm } from "@/components/BillOfSaleForm";

export default function NewBillOfSalePage() {
  return (
    <div>
      <Link href="/engine-sales" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
        ← Engine Sales
      </Link>
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>New Bill of Sale</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Saves a record and opens a printable copy to sign with the customer.
      </p>
      <BillOfSaleForm />
    </div>
  );
}
