"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle: React.CSSProperties = {
  background: "var(--panel-raised)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "5px 8px",
  fontSize: 13,
  width: 110,
};

export function ShipForm({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function markShipped() {
    setSubmitting(true);
    await fetch(`/api/orders/${orderId}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipping_status: "shipped",
        carrier: carrier || null,
        tracking_number: tracking || null,
      }),
    });
    setSubmitting(false);
    router.refresh();
  }

  async function markDelivered() {
    setSubmitting(true);
    await fetch(`/api/orders/${orderId}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipping_status: "delivered" }),
    });
    setSubmitting(false);
    router.refresh();
  }

  if (currentStatus === "awaiting_shipment") {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} style={inputStyle} />
        <input
          placeholder="Tracking #"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={markShipped}
          disabled={submitting}
          style={{
            background: "var(--tag-yellow)",
            color: "#211f1d",
            border: "none",
            borderRadius: 4,
            padding: "6px 12px",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Mark shipped
        </button>
      </div>
    );
  }

  if (currentStatus === "shipped") {
    return (
      <button
        onClick={markDelivered}
        disabled={submitting}
        style={{
          background: "var(--tag-green)",
          color: "#211f1d",
          border: "none",
          borderRadius: 4,
          padding: "6px 12px",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Mark delivered
      </button>
    );
  }

  return <span className="status-pill">{currentStatus}</span>;
}
