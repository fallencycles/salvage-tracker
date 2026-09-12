"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buildTrackingEmail } from "@/lib/bolEmail";

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

export default function ComposeTrackingEmailPage() {
  const params = useParams<{ id: string }>();
  const shipmentId = params.id;

  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/engine-sales/shipments/${shipmentId}`)
      .then((r) => r.json())
      .then((shipment) => {
        const email = buildTrackingEmail(shipment);
        setTo(email.to);
        setSubject(email.subject);
        setBody(email.body);
      })
      .finally(() => setLoading(false));
  }, [shipmentId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/engine-sales/shipments/${shipmentId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink-dim)" }}>Loading…</p>;

  return (
    <div>
      <Link
        href={`/engine-sales/shipments/${shipmentId}`}
        style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}
      >
        ← Shipment #{shipmentId}
      </Link>
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>Send tracking email</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Review and edit before sending — nothing goes out automatically. Delivery isn't wired up
        to a real provider yet, so this logs the email to the shipment's activity log without
        actually sending it.
      </p>

      {sent ? (
        <div style={panel}>
          <p style={{ margin: 0 }}>Logged. (No email provider is connected yet — see the note above.)</p>
        </div>
      ) : (
        <form onSubmit={handleSend}>
          <div style={panel}>
            <div style={field}>
              <label style={label} htmlFor="to">
                To
              </label>
              <input id="to" style={input} value={to} onChange={(e) => setTo(e.target.value)} required />
              {!to && (
                <p style={{ color: "var(--tag-rust)", fontSize: 12, marginTop: 4 }}>
                  No email on file for this shipment — add one above.
                </p>
              )}
            </div>
            <div style={field}>
              <label style={label} htmlFor="subject">
                Subject
              </label>
              <input id="subject" style={input} value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div style={field}>
              <label style={label} htmlFor="body">
                Body
              </label>
              <textarea
                id="body"
                style={{ ...input, minHeight: 200, fontFamily: "inherit", resize: "vertical" }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p style={{ color: "var(--tag-rust)" }}>{error}</p>}

          <button
            type="submit"
            disabled={sending}
            style={{
              background: "var(--tag-yellow)",
              color: "#211f1d",
              border: "none",
              borderRadius: 4,
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: 14,
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}
