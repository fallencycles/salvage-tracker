"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const input: React.CSSProperties = {
  background: "var(--panel-raised)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 14,
  width: "100%",
};
const label: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-dim)",
  marginBottom: 4,
  display: "block",
};
const field: React.CSSProperties = { marginBottom: 14 };
const panel: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 18,
  marginBottom: 16,
};

function Field({
  name,
  labelText,
  value,
  onChange,
}: {
  name: string;
  labelText: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={field}>
      <label style={label} htmlFor={name}>
        {labelText}
      </label>
      <input id={name} name={name} style={input} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ShipmentForm() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [stockNumber, setStockNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/engine-sales/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: customerName,
        customer_email: customerEmail,
        stock_number: stockNumber,
        carrier,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create the shipment.");
      return;
    }

    const shipment = await res.json();
    router.push(`/engine-sales/shipments/${shipment.id}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={panel}>
        <Field name="customer_name" labelText="Customer name" value={customerName} onChange={setCustomerName} />
        <Field name="customer_email" labelText="Customer email" value={customerEmail} onChange={setCustomerEmail} />
        <Field name="stock_number" labelText="Stock number" value={stockNumber} onChange={setStockNumber} />
        <Field name="carrier" labelText="Carrier" value={carrier} onChange={setCarrier} />
      </div>

      {error && <p style={{ color: "var(--tag-rust)" }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        style={{
          background: "var(--tag-yellow)",
          color: "#211f1d",
          border: "none",
          borderRadius: 4,
          padding: "10px 18px",
          fontWeight: 600,
          fontSize: 14,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Creating…" : "Create shipment"}
      </button>
    </form>
  );
}
