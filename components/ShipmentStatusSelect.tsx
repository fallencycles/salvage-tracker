"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["quoted", "booked", "picked_up", "invoiced", "reconciled"];

export function ShipmentStatusSelect({ shipmentId, status }: { shipmentId: number; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: string) {
    setValue(next);
    setSaving(true);
    await fetch(`/api/engine-sales/shipments/${shipmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      style={{
        background: "var(--panel-raised)",
        color: "var(--ink)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "6px 8px",
        fontSize: 13,
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
