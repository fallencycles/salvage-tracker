"use client";

import { useEffect, useMemo, useState } from "react";
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
  type = "text",
  value,
  onChange,
  required,
}: {
  name: string;
  labelText: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div style={field}>
      <label style={label} htmlFor={name}>
        {labelText}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        style={input}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function BillOfSaleForm() {
  const router = useRouter();
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [vin, setVin] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [mileage, setMileage] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [shipping, setShipping] = useState("");
  const [salesTax, setSalesTax] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<{ id: number; customer_name: string | null }[]>([]);
  const [shipmentChoice, setShipmentChoice] = useState<"none" | "new" | number>("none");

  useEffect(() => {
    fetch("/api/engine-sales/shipments")
      .then((r) => r.json())
      .then((rows) => setShipments(rows))
      .catch(() => {});
  }, []);

  const total = useMemo(() => {
    const sum = [itemPrice, shipping, salesTax]
      .map((v) => Number(v))
      .filter((n) => !Number.isNaN(n))
      .reduce((a, b) => a + b, 0);
    return sum.toFixed(2);
  }, [itemPrice, shipping, salesTax]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const cityStateZip = [city.trim(), [state.trim(), zip.trim()].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    const customerAddress = [street.trim(), cityStateZip].filter(Boolean).join(", ");

    let shipmentId: number | null = null;
    if (shipmentChoice === "new") {
      const shipRes = await fetch("/api/engine-sales/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: customerName }),
      });
      if (shipRes.ok) shipmentId = (await shipRes.json()).id;
    } else if (typeof shipmentChoice === "number") {
      shipmentId = shipmentChoice;
    }

    const res = await fetch("/api/engine-sales/bill-of-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipment_id: shipmentId,
        sale_date: saleDate,
        customer_name: customerName,
        customer_address: customerAddress,
        customer_contact: customerContact,
        item_description: itemDescription,
        vin,
        serial_number: serialNumber,
        mileage,
        item_price: itemPrice || null,
        shipping: shipping || null,
        sales_tax: salesTax || null,
        total: total || null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save the bill of sale.");
      return;
    }

    const record = await res.json();
    router.push(`/engine-sales/bill-of-sale/${record.id}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={panel}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Attach to shipment (optional)</h2>
        <div style={field}>
          <label style={label} htmlFor="shipment_choice">
            Shipment case
          </label>
          <select
            id="shipment_choice"
            style={input}
            value={String(shipmentChoice)}
            onChange={(e) =>
              setShipmentChoice(
                e.target.value === "none" || e.target.value === "new"
                  ? e.target.value
                  : Number(e.target.value)
              )
            }
          >
            <option value="none">No shipment yet</option>
            <option value="new">Create a new shipment case</option>
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} — {s.customer_name ?? "Unnamed"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={panel}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Customer</h2>
        <Field name="sale_date" labelText="Sale date" type="date" value={saleDate} onChange={setSaleDate} required />
        <Field name="customer_name" labelText="Customer name" value={customerName} onChange={setCustomerName} required />
        <Field name="street" labelText="Street" value={street} onChange={setStreet} required />
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <Field name="city" labelText="City" value={city} onChange={setCity} required />
          <Field name="state" labelText="State" value={state} onChange={setState} required />
          <Field name="zip" labelText="ZIP" value={zip} onChange={setZip} required />
        </div>
        <Field name="customer_contact" labelText="Customer contact (phone/email)" value={customerContact} onChange={setCustomerContact} />
      </div>

      <div style={panel}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Item</h2>
        <Field name="item_description" labelText="Item description" value={itemDescription} onChange={setItemDescription} required />
        <Field name="vin" labelText="VIN" value={vin} onChange={setVin} />
        <Field name="serial_number" labelText="Serial number" value={serialNumber} onChange={setSerialNumber} />
        <Field name="mileage" labelText="Mileage" value={mileage} onChange={setMileage} />
      </div>

      <div style={panel}>
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>Payment</h2>
        <Field name="item_price" labelText="Item price" type="number" value={itemPrice} onChange={setItemPrice} />
        <Field name="shipping" labelText="Shipping" type="number" value={shipping} onChange={setShipping} />
        <Field name="sales_tax" labelText="Sales tax" type="number" value={salesTax} onChange={setSalesTax} />
        <div style={field}>
          <div style={label}>Total</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>${total}</div>
        </div>
      </div>

      {error && <p style={{ color: "var(--tag-rust, #c0533b)" }}>{error}</p>}

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
        {submitting ? "Saving…" : "Create Bill of Sale"}
      </button>
    </form>
  );
}
