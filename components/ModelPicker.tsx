"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CatalogModelOption = {
  code: string;
  family: string;
  name: string | null;
  year_start: number;
  year_end: number;
};

// Family display order — mirrors MODEL_FAMILIES in lib/catalog.ts. Anything
// else falls into "Other", which sorts last.
const FAMILY_ORDER = ["Touring", "Softail", "Dyna", "FXR", "Sportster", "V-Rod", "Trike"];

export type ModelGroup = {
  family: string;
  items: { code: string; name: string | null; primary: string; value: string }[];
};

// Produce the grouped, filtered option list the dropdown renders: filter by the
// chosen year's span, then by typed text (name OR code), then group by family in
// FAMILY_ORDER (unknowns + "Other" last), deduped by code.
function groupModelsForPicker(
  models: CatalogModelOption[],
  year: string,
  query: string
): ModelGroup[] {
  const y = Number(year);
  const hasYear = year.trim() !== "" && !Number.isNaN(y);
  const q = query.trim().toLowerCase();

  const byFamily = new Map<string, ModelGroup["items"]>();
  const seenPerFamily = new Map<string, Set<string>>();

  for (const m of models) {
    if (hasYear && !(m.year_start <= y && m.year_end >= y)) continue;
    if (q && !(`${m.name ?? ""}`.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))) {
      continue;
    }

    const family = FAMILY_ORDER.includes(m.family) ? m.family : m.family || "Other";
    let seen = seenPerFamily.get(family);
    if (!seen) seenPerFamily.set(family, (seen = new Set()));
    if (seen.has(m.code)) continue;
    seen.add(m.code);

    const items = byFamily.get(family) ?? [];
    items.push({
      code: m.code,
      name: m.name,
      primary: m.name ?? m.code,
      value: m.name ? `${m.name} — ${m.code}` : m.code,
    });
    byFamily.set(family, items);
  }

  const ordered = [
    ...FAMILY_ORDER.filter((f) => byFamily.has(f)),
    ...[...byFamily.keys()].filter((f) => !FAMILY_ORDER.includes(f)).sort(),
  ];

  return ordered.map((family) => ({
    family,
    items: byFamily.get(family)!.sort((a, b) => {
      if (!a.name && b.name) return 1;
      if (a.name && !b.name) return -1;
      return (a.name ?? "").localeCompare(b.name ?? "") || a.code.localeCompare(b.code);
    }),
  }));
}

export function ModelPicker({
  models,
  year,
  value,
  onChange,
}: {
  models: CatalogModelOption[];
  year: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);

  const groups = useMemo(
    () => groupModelsForPicker(models, year, open ? query : ""),
    [models, year, open, query]
  );
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Reset the highlight whenever the visible list changes.
  useEffect(() => setActiveIdx(-1), [query, year, open]);

  function pick(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0 && flat[activeIdx]) {
      e.preventDefault();
      pick(flat[activeIdx].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        name="moto_model"
        value={open ? query : value}
        placeholder={value || "Model — pick or type"}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value); // free-typed values still persist
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        style={{
          background: "var(--panel-raised)",
          color: "var(--ink)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "8px 10px",
          fontSize: 14,
          width: "100%",
        }}
      />
      {value && !open && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear model"
          style={{
            position: "absolute",
            right: 6,
            top: 7,
            border: "none",
            background: "none",
            color: "var(--ink-dim)",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ×
        </button>
      )}

      {open && (
        <div className="cat-pop" style={{ width: "min(340px, 90vw)" }}>
          <div className="cat-pop-list">
            {flat.length === 0 && <div className="cat-pop-empty">No models match</div>}
            {groups.map((g) => (
              <div key={g.family}>
                <div className="cat-ta-group">{g.family}</div>
                {g.items.map((it) => {
                  const idx = flat.indexOf(it);
                  return (
                    <button
                      type="button"
                      key={it.code + it.value}
                      className="cat-ta-item"
                      data-active={idx === activeIdx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => pick(it.value)}
                      title={it.value}
                    >
                      <span>{it.primary}</span>
                      <span className="sub">{it.code}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
