"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function GateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/catalog";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // full navigation so the middleware re-runs with the new cookie
        window.location.href = next.startsWith("/") ? next : "/catalog";
        return;
      }
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Incorrect password");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "min(360px, 100%)",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "28px 24px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            fontSize: 14,
            marginBottom: 4,
          }}
        >
          FALLEN CYCLES
        </div>
        <div style={{ color: "var(--ink-dim)", fontSize: 13, marginBottom: 20 }}>
          Enter the access password to continue.
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          style={{
            width: "100%",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--ink)",
            fontSize: 14,
            padding: "10px 12px",
            fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />

        {error && (
          <div style={{ color: "var(--tag-rust)", fontSize: 12.5, marginTop: 10 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          style={{
            width: "100%",
            marginTop: 16,
            background: "var(--tag-yellow)",
            color: "#211f1d",
            border: "none",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy || !password ? "default" : "pointer",
            opacity: busy || !password ? 0.6 : 1,
          }}
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={null}>
      <GateForm />
    </Suspense>
  );
}
