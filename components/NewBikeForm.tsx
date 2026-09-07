"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle: React.CSSProperties = {
  background: "var(--panel-raised)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 14,
  width: "100%",
};

export function NewBikeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());

    const res = await fetch("/api/bikes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 18,
        marginBottom: 28,
      }}
    >
      <input name="stock_number" placeholder="Stock # (required)" required style={inputStyle} />
      <input name="year" placeholder="Year" style={inputStyle} />
      <input name="make" placeholder="Make" style={inputStyle} />
      <input name="model" placeholder="Model" style={inputStyle} />
      <input name="vin" placeholder="VIN" style={inputStyle} />
      <input name="purchase_source" placeholder="Purchase source" style={inputStyle} />
      <input name="purchase_price" placeholder="Purchase price" style={inputStyle} />
      <input name="purchase_date" type="date" style={inputStyle} />
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: "var(--tag-yellow)",
            color: "#211f1d",
            border: "none",
            borderRadius: 4,
            padding: "9px 18px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {submitting ? "Adding…" : "Add bike"}
        </button>
        {error && <span style={{ color: "var(--tag-rust)", fontSize: 13 }}>{error}</span>}
      </div>
    </form>
  );
}
