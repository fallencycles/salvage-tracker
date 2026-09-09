"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ComponentRow } from "@/lib/catalog";

export function ComponentIndex({ rows }: { rows: ComponentRow[] }) {
  const [q, setQ] = useState("");
  const f = q.trim().toLowerCase();

  const shown = useMemo(
    () => (f ? rows.filter((r) => r.name.toLowerCase().includes(f)) : rows),
    [rows, f]
  );

  // group alphabetically by leading letter; anything non-alpha lands under "#"
  const groups = useMemo(() => {
    const m = new Map<string, ComponentRow[]>();
    for (const r of shown) {
      const c = (r.name[0] ?? "").toUpperCase();
      const key = c >= "A" && c <= "Z" ? c : "#";
      let bucket = m.get(key);
      if (!bucket) m.set(key, (bucket = []));
      bucket.push(r);
    }
    return [...m.entries()];
  }, [shown]);

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          paddingBottom: 8,
          zIndex: 5,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter components…"
          autoComplete="off"
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--ink)",
            fontSize: 14,
            fontFamily: "var(--font-mono)",
            padding: "10px 12px",
            outline: "none",
          }}
        />
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--ink-dim)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {shown.length.toLocaleString()} of {rows.length.toLocaleString()}
        </div>
      </div>

      {groups.map(([letter, items]) => (
        <section key={letter} style={{ marginTop: 14 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "var(--ink-dim)",
              borderBottom: "1px solid var(--border)",
              padding: "0 10px 4px",
              marginBottom: 2,
            }}
          >
            {letter}
          </div>
          {items.map((r) => (
            <Link
              key={r.name}
              href={`/catalog?q=${encodeURIComponent(r.name)}`}
              className="ci-row"
              title={`${r.parts.toLocaleString()} parts · ${r.catalogs} catalog${
                r.catalogs === 1 ? "" : "s"
              }`}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {r.parts.toLocaleString()}
              </span>
            </Link>
          ))}
        </section>
      ))}

      {shown.length === 0 && (
        <div style={{ color: "var(--ink-dim)", padding: "20px 0", fontSize: 14 }}>
          No components match “{q}”.
        </div>
      )}
    </div>
  );
}
