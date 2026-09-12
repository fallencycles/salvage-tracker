"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EbayOrder } from "@/lib/ebayOrderExtraction";

const card: React.CSSProperties = {
  background: "var(--panel-raised, #1a1a1a)",
  border: "1px solid var(--border, #333)",
  borderRadius: 8,
  padding: 16,
  marginTop: 16,
};

const label: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--ink-dim)",
};

const value: React.CSSProperties = {
  fontSize: 14,
  marginBottom: 10,
  wordBreak: "break-word",
};

function Field({ name, val }: { name: string; val: unknown }) {
  if (val === null || val === undefined || val === "") return null;
  return (
    <div>
      <div style={label}>{name.replace(/_/g, " ")}</div>
      <div style={value}>{String(val)}</div>
    </div>
  );
}

export default function EngineSalesOrdersPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EbayOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/engine-sales/orders-intake/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push(`/engine-sales/shipments/${data.shipment_id}`);
    } catch (err: any) {
      setSaveError(err.message || "Could not save.");
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/engine-sales/orders-intake", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const fieldEntries = result
    ? Object.entries(result).filter(([k]) => k !== "handwritten_notes" && k !== "notes")
    : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>eBay order intake (draft)</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Upload a photo, screenshot, or PDF of an eBay order details page — including printed
        copies with handwritten investigation notes — and it extracts the order fields plus
        transcribes any handwritten notes separately. Nothing is saved to the database yet.
      </p>
      <p style={{ marginTop: -12, marginBottom: 20 }}>
        <Link href="/engine-sales" style={{ textDecoration: "underline", fontSize: 13 }}>
          ← Engine Sales overview
        </Link>
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="submit"
          disabled={!file || loading}
          style={{
            background: "var(--tag-yellow)",
            color: "#211f1d",
            border: "none",
            borderRadius: 4,
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: 14,
            cursor: file && !loading ? "pointer" : "not-allowed",
            opacity: file && !loading ? 1 : 0.6,
          }}
        >
          {loading ? "Reading document…" : "Extract"}
        </button>
      </form>

      {error && <p style={{ color: "var(--tag-rust, #c0533b)", marginTop: 16 }}>{error}</p>}

      {result && (
        <div>
          {result.handwritten_notes && (
            <div style={{ ...card, borderColor: "var(--tag-yellow)" }}>
              <div style={label}>Handwritten notes (transcribed)</div>
              <div style={{ ...value, whiteSpace: "pre-wrap" }}>{result.handwritten_notes}</div>
            </div>
          )}

          <div style={card}>
            <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 12 }}>Order</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 4,
              }}
            >
              {fieldEntries.map(([k, v]) => (
                <Field key={k} name={k} val={v} />
              ))}
            </div>
          </div>

          {result.notes && (
            <div style={card}>
              <div style={label}>Notes from extraction</div>
              <div style={value}>{result.notes}</div>
            </div>
          )}

          <div style={card}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                background: "var(--tag-yellow)",
                color: "#211f1d",
                border: "none",
                borderRadius: 4,
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save as shipment"}
            </button>
            {saveError && <p style={{ color: "var(--tag-rust, #c0533b)", marginTop: 10 }}>{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
