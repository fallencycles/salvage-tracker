"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ComponentCategory } from "@/lib/catalog";

export function ComponentCategories({ categories }: { categories: ComponentCategory[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const f = q.trim().toLowerCase();

  // When filtering, keep only categories with a matching section and show just
  // those sections — every hit is visible without opening anything.
  const view = useMemo(() => {
    if (!f) return categories.map((c) => ({ ...c, shown: c.members }));
    return categories
      .map((c) => ({ ...c, shown: c.members.filter((m) => m.name.toLowerCase().includes(f)) }))
      .filter((c) => c.shown.length > 0);
  }, [categories, f]);

  const toggle = (label: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });

  return (
    <div>
      <div style={{ position: "sticky", top: 0, background: "var(--bg)", paddingBottom: 8, zIndex: 5 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter sections…"
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
      </div>

      {view.map((c) => {
        const expanded = !!f || open.has(c.label);
        return (
          <div key={c.label} className="ci-cat">
            <button
              type="button"
              className="ci-cat-head"
              onClick={() => !f && toggle(c.label)}
              aria-expanded={expanded}
            >
              <span className="ci-cat-caret" data-open={expanded}>
                ▸
              </span>
              <span className="ci-cat-name">{c.label}</span>
              <span className="ci-cat-count">
                {c.shown.length}
                {f ? "" : ` · ${c.parts.toLocaleString()}`}
              </span>
            </button>
            {expanded && (
              <div className="ci-cat-body">
                {c.shown.map((m) => (
                  <Link
                    key={m.name}
                    href={`/catalog?q=${encodeURIComponent(m.name)}`}
                    className="ci-row"
                    title={`${m.parts.toLocaleString()} parts · ${m.catalogs} catalog${
                      m.catalogs === 1 ? "" : "s"
                    }`}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.name}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        color: "var(--ink-dim)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                      }}
                    >
                      {m.parts.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {view.length === 0 && (
        <div style={{ color: "var(--ink-dim)", padding: "20px 0", fontSize: 14 }}>
          No sections match “{q}”.
        </div>
      )}
    </div>
  );
}
