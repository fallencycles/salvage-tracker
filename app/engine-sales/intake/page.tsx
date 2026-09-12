"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BolDocument } from "@/lib/bolExtraction";

type ShipmentOption = { id: number; customer_name: string | null; bol_number: string | null };
type MatchResult = { auto: ShipmentOption | null; candidates: ShipmentOption[] };

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

function Section({ title, fields }: { title: string; fields: Record<string, unknown> }) {
  return (
    <div style={card}>
      <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 12 }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 4 }}>
        {Object.entries(fields).map(([k, v]) => (
          <Field key={k} name={k} val={v} />
        ))}
      </div>
    </div>
  );
}

export default function EngineSalesIntakePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BolDocument | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [shipmentChoice, setShipmentChoice] = useState<"auto" | "new" | number>("auto");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMatch(null);
    setSaveMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/engine-sales/intake", { method: "POST", body });
      const data: BolDocument = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Extraction failed");
      setResult(data);

      if (data.document_type !== "invoice" && data.document_type !== "unknown") {
        const bolNumber = data.shipment?.bol_number ?? null;
        const customerName =
          data.shipment?.customer_name ?? data.quote?.customer_name ?? data.bill_of_sale?.customer_name ?? null;
        const matchRes = await fetch("/api/engine-sales/shipments/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bol_number: bolNumber, customer_name: customerName }),
        });
        const matchData: MatchResult = await matchRes.json();
        setMatch(matchData);
        setShipmentChoice(matchData.auto ? "auto" : "new");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const shipment_id =
        shipmentChoice === "auto"
          ? match?.auto?.id
          : shipmentChoice === "new"
            ? undefined
            : shipmentChoice;
      const res = await fetch("/api/engine-sales/intake/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: result, shipment_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      if (data.shipment_id) {
        router.push(`/engine-sales/shipments/${data.shipment_id}`);
      } else {
        setSaveMessage(`Saved invoice #${data.invoice_id}.`);
      }
    } catch (err: any) {
      setSaveMessage(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Document intake (draft)</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Upload a photo or PDF of a Bill of Lading, freight quote, freight invoice, or bill of
        sale — it reads the document and shows back everything it found, mapped to the{" "}
        <Link href="/engine-sales/schema" style={{ textDecoration: "underline" }}>
          draft schema
        </Link>
        . Nothing is saved to the database yet.
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

      {error && (
        <p style={{ color: "var(--tag-rust, #c0533b)", marginTop: 16 }}>{error}</p>
      )}

      {result && (
        <div>
          <p style={{ marginTop: 20, marginBottom: 0 }}>
            <span className="status-pill">{result.document_type.replace(/_/g, " ")}</span>
          </p>

          {result.shipment && <Section title="Shipment / BOL" fields={result.shipment} />}
          {result.quote && <Section title="Quote" fields={result.quote} />}
          {result.invoice && (
            <div style={card}>
              <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 12 }}>Invoice</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 4 }}>
                <Field name="invoice_number" val={result.invoice.invoice_number} />
                <Field name="invoice_date" val={result.invoice.invoice_date} />
                <Field name="due_date" val={result.invoice.due_date} />
                <Field name="account_number" val={result.invoice.account_number} />
                <Field name="amount_due" val={result.invoice.amount_due} />
              </div>
              {result.invoice.lines.map((line, i) => (
                <div key={i} style={{ ...card, marginTop: 12, background: "var(--panel, #111)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Line {i + 1}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 4 }}>
                    {Object.entries(line)
                      .filter(([k]) => k !== "charges")
                      .map(([k, v]) => (
                        <Field key={k} name={k} val={v} />
                      ))}
                  </div>
                  {line.charges.length > 0 && (
                    <table className="board-table" style={{ marginTop: 8 }}>
                      <thead>
                        <tr>
                          <th>Charge type</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {line.charges.map((c, ci) => (
                          <tr key={ci}>
                            <td>{c.charge_type}</td>
                            <td>${c.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
          {result.bill_of_sale && <Section title="Bill of sale" fields={result.bill_of_sale} />}
          {result.notes && (
            <div style={{ ...card, borderColor: "var(--tag-yellow)" }}>
              <div style={label}>Notes from extraction</div>
              <div style={value}>{result.notes}</div>
            </div>
          )}

          {result.document_type !== "unknown" && (
            <div style={card}>
              <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 12 }}>Save</h2>

              {match && (
                <div style={{ marginBottom: 12 }}>
                  <div style={label}>Shipment case</div>
                  <select
                    value={String(shipmentChoice)}
                    onChange={(e) =>
                      setShipmentChoice(
                        e.target.value === "auto" || e.target.value === "new"
                          ? e.target.value
                          : Number(e.target.value)
                      )
                    }
                    style={{
                      background: "var(--panel-raised)",
                      color: "var(--ink)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: "8px 10px",
                      fontSize: 14,
                      width: "100%",
                      marginTop: 4,
                    }}
                  >
                    {match.auto && (
                      <option value="auto">
                        Matched: #{match.auto.id} — {match.auto.customer_name ?? "Unnamed"}
                      </option>
                    )}
                    <option value="new">Create a new shipment case</option>
                    {match.candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.id} — {c.customer_name ?? "Unnamed"}
                        {c.bol_number ? ` (BOL ${c.bol_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {result.document_type === "invoice" && (
                <p style={{ color: "var(--ink-dim)", fontSize: 13, marginBottom: 12 }}>
                  Invoice lines are matched to shipments automatically by BOL number.
                </p>
              )}

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
                {saving ? "Saving…" : "Save"}
              </button>

              {saveMessage && <p style={{ marginTop: 12 }}>{saveMessage}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
