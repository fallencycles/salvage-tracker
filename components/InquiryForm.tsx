"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ModelPicker, type CatalogModelOption } from "@/components/ModelPicker";

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

const panel: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 18,
  marginBottom: 16,
};

type PartLine = {
  key: number;
  id: number | null;
  oem_part_number: string;
  description: string;
  notes: string;
  source: "manual" | "catalog";
  catalog_part_no: string | null;
};

let nextKey = 1;
const blankLine = (): PartLine => ({
  key: nextKey++,
  id: null,
  oem_part_number: "",
  description: "",
  notes: "",
  source: "manual",
  catalog_part_no: null,
});

const isEmptyLine = (l: PartLine) => !l.oem_part_number.trim() && !l.description.trim();

// The model field stores what ModelPicker produced: "Road King — FLHR" when a
// catalog model was picked, or whatever the user free-typed. The catalog search
// needs the bare model_code ("FLHR") to scope results, and exact-matches it.
// Returns "" for a free-typed value that has no " — " separator to trust.
function parseModelCode(model: string): string {
  const parts = model.split(" — ");
  return parts.length > 1 ? parts[parts.length - 1].trim() : "";
}

// Format a phone number as it's typed so every row in the CSV looks the same.
// Called on every keystroke: `raw` is the full current field value (already
// partly formatted from the last keystroke); the return value replaces it.
// Idempotent — format(format(x)) === format(x) — so re-feeding its own output
// doesn't fight the cursor.
function formatPhoneInput(raw: string): string {
  // Leave an international number alone rather than mangling it into a US mask.
  if (raw.trim().startsWith("+")) return raw.trim();

  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("1")) d = d.slice(1); // strip country code
  d = d.slice(0, 10);

  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// Full model rows now — the picker filters by year and shows/searches codes.
export type ModelOption = CatalogModelOption;

export type InitialInquiry = {
  id: number;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  moto_year: string | null;
  moto_make: string | null;
  moto_model: string | null;
  taken_by: string | null;
  notes: string | null;
  status: string;
  parts: {
    id: number;
    oem_part_number: string | null;
    description: string | null;
    notes: string | null;
    source: string;
    catalog_part_no: string | null;
  }[];
};

type CatalogHit = {
  part_no: string;
  part_no_normalized: string;
  description: string | null;
  component: string | null;
};

function linesFromInitial(initial: InitialInquiry): PartLine[] {
  const rows = initial.parts.map((p) => ({
    key: nextKey++,
    id: p.id,
    oem_part_number: p.oem_part_number ?? "",
    description: p.description ?? "",
    notes: p.notes ?? "",
    source: p.source === "catalog" ? ("catalog" as const) : ("manual" as const),
    catalog_part_no: p.catalog_part_no,
  }));
  // Always leave one spare blank line to type into.
  return [...rows, blankLine()];
}

export function InquiryForm({
  models,
  initial,
}: {
  models: ModelOption[];
  initial?: InitialInquiry;
}) {
  const router = useRouter();
  const editing = !!initial;
  const formRef = useRef<HTMLFormElement>(null);
  const [lines, setLines] = useState<PartLine[]>(() =>
    initial ? linesFromInitial(initial) : [blankLine(), blankLine(), blankLine()]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  // Phone is the one contact field we format as it's typed, so the CSV is
  // consistent. Kept in state (the rest are read straight off the form).
  const [phone, setPhone] = useState(() => formatPhoneInput(initial?.phone ?? ""));
  // Year + model are in state so the model picker can filter by the year.
  const [year, setYear] = useState(initial?.moto_year ?? "");
  const [model, setModel] = useState(initial?.moto_model ?? "");
  // When a bike is entered, scope the catalog part search to parts that fit it.
  const [scopeToBike, setScopeToBike] = useState(true);
  const motoModelCode = useMemo(() => parseModelCode(model), [model]);
  const hasBike = !!(year.trim() || motoModelCode);
  const scoping = scopeToBike && hasBike;

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now + 1 - 1975 + 1 }, (_, i) => now + 1 - i);
  }, []);

  function setLine(key: number, patch: Partial<PartLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }
  function removeLine(key: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  // Drop a catalog hit into the first empty line, or append a fresh one.
  function addFromCatalog(hit: CatalogHit) {
    setLines((prev) => {
      const filled: PartLine = {
        ...blankLine(),
        oem_part_number: hit.part_no,
        description: hit.description ?? "",
        source: "catalog",
        catalog_part_no: hit.part_no_normalized,
      };
      const idx = prev.findIndex(isEmptyLine);
      if (idx === -1) return [...prev, filled];
      const next = prev.slice();
      next[idx] = { ...filled, key: prev[idx].key, id: prev[idx].id };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      customer_name: fd.get("customer_name"),
      phone: phone.trim(),
      email: fd.get("email"),
      company: fd.get("company"),
      moto_year: year.trim(),
      moto_make: fd.get("moto_make"),
      moto_model: model.trim(),
      taken_by: fd.get("taken_by"),
      notes: fd.get("notes"),
      parts: lines.map((l) => ({
        id: l.id,
        oem_part_number: l.oem_part_number,
        description: l.description,
        notes: l.notes,
        source: l.source,
        catalog_part_no: l.catalog_part_no,
      })),
    };
    if (editing) payload.status = fd.get("status");

    const res = await fetch(
      editing ? `/api/inquiries/${initial!.id}` : "/api/inquiries",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving the inquiry.");
      return;
    }

    if (editing) {
      const fresh = (await res.json()) as InitialInquiry;
      setLines(linesFromInitial(fresh));
      setPhone(formatPhoneInput(fresh.phone ?? ""));
      setYear(fresh.moto_year ?? "");
      setModel(fresh.moto_model ?? "");
      setSavedMsg("Changes saved.");
      router.refresh();
    } else {
      formRef.current?.reset();
      setLines([blankLine(), blankLine(), blankLine()]);
      setPhone("");
      setYear("");
      setModel("");
      setSavedMsg("Saved. Ready for the next call.");
      router.refresh();
      formRef.current?.querySelector<HTMLInputElement>('input[name="customer_name"]')?.focus();
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div style={panel}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label style={label}>Customer name</label>
            <input
              name="customer_name"
              autoFocus={!editing}
              defaultValue={initial?.customer_name ?? ""}
              style={input}
            />
          </div>
          <div>
            <label style={label}>Phone</label>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              placeholder="(555) 123-4567"
              style={input}
            />
          </div>
          <div>
            <label style={label}>Email</label>
            <input name="email" type="email" defaultValue={initial?.email ?? ""} style={input} />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={label}>Company / shop</label>
            <input name="company" defaultValue={initial?.company ?? ""} style={input} />
          </div>
          <div>
            <label style={label}>Taken by</label>
            <input name="taken_by" defaultValue={initial?.taken_by ?? ""} style={input} />
          </div>
          {editing && (
            <div>
              <label style={label}>Status</label>
              <select name="status" defaultValue={initial!.status} style={input}>
                <option value="open">open</option>
                <option value="closed">closed</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={panel}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div>
            <label style={label}>Year</label>
            <input
              name="moto_year"
              list="inq-years"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={input}
            />
            <datalist id="inq-years">
              {years.map((y) => (
                <option key={y} value={y} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={label}>Make</label>
            <input
              name="moto_make"
              defaultValue={initial?.moto_make ?? "Harley-Davidson"}
              list="inq-makes"
              style={input}
            />
            <datalist id="inq-makes">
              <option value="Harley-Davidson" />
              <option value="Buell" />
              <option value="Other" />
            </datalist>
          </div>
          <div>
            <label style={label}>
              Model {year ? <span style={{ color: "var(--ink-dim)" }}>· {year} only</span> : null}
            </label>
            <ModelPicker models={models} year={year} value={model} onChange={setModel} />
          </div>
        </div>
      </div>

      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ ...label, marginBottom: 0 }}>Parts requested</span>
          <button type="button" onClick={addLine} style={ghostBtn}>
            + Add blank line
          </button>
        </div>

        {hasBike && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--ink-dim)",
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={scopeToBike}
              onChange={(e) => setScopeToBike(e.target.checked)}
            />
            Only parts that fit this bike
            {scoping && (
              <span style={{ color: "var(--ink)" }}>
                ({[year.trim(), motoModelCode].filter(Boolean).join(" · ")})
              </span>
            )}
          </label>
        )}

        <CatalogPartSearch
          onAdd={addFromCatalog}
          year={scoping ? year.trim() : ""}
          modelCode={scoping ? motoModelCode : ""}
        />

        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <div style={partGrid}>
            <span style={miniHead}>OEM part #</span>
            <span style={miniHead}>Description</span>
            <span style={miniHead}>Notes</span>
            <span />
          </div>
          {lines.map((l) => (
            <div key={l.key} style={partGrid}>
              <div style={{ position: "relative" }}>
                <input
                  value={l.oem_part_number}
                  onChange={(e) =>
                    setLine(l.key, { oem_part_number: e.target.value, source: "manual", catalog_part_no: null })
                  }
                  style={{ ...input, fontFamily: "var(--font-mono)" }}
                  placeholder="e.g. 61300123"
                />
                {l.source === "catalog" && (
                  <span title="From parts catalog" style={catalogTag}>
                    catalog
                  </span>
                )}
              </div>
              <input
                value={l.description}
                onChange={(e) => setLine(l.key, { description: e.target.value })}
                style={input}
                placeholder="what the part is"
              />
              <input
                value={l.notes}
                onChange={(e) => setLine(l.key, { notes: e.target.value })}
                style={input}
                placeholder="condition, fitment, etc."
              />
              <button
                type="button"
                onClick={() => removeLine(l.key)}
                style={removeBtn}
                aria-label="Remove part"
                title="Remove part"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={panel}>
        <label style={label}>Notes for this call</label>
        <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} style={{ ...input, resize: "vertical" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="submit" disabled={submitting} style={saveBtn}>
          {submitting ? "Saving…" : editing ? "Save changes" : "Save inquiry"}
        </button>
        {savedMsg && <span style={{ color: "var(--tag-green)", fontSize: 13 }}>{savedMsg}</span>}
        {error && <span style={{ color: "var(--tag-rust)", fontSize: 13 }}>{error}</span>}
      </div>
    </form>
  );
}

// --- inline catalog search: type a part # or name, click a hit to add it ---
function CatalogPartSearch({
  onAdd,
  year = "",
  modelCode = "",
}: {
  onAdd: (hit: CatalogHit) => void;
  year?: string;
  modelCode?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: term });
        if (year) params.set("year", year);
        if (modelCode) params.set("model", modelCode);
        const res = await fetch(`/api/catalog/search?${params}`, { signal: ctrl.signal });
        const data = await res.json();
        setHits((data.results ?? []).slice(0, 8));
        setOpen(true);
      } catch {
        /* aborted or failed — leave last results */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, year, modelCode]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="Search the parts catalog — part number or name"
        style={{ ...input, borderColor: "var(--tag-blue)" }}
      />
      {loading && (
        <span style={{ position: "absolute", right: 10, top: 9, fontSize: 12, color: "var(--ink-dim)" }}>
          …
        </span>
      )}
      {open && hits.length > 0 && (
        <div style={hitBox}>
          {hits.map((h) => (
            <button
              key={h.part_no_normalized}
              type="button"
              onClick={() => {
                onAdd(h);
                setQ("");
                setHits([]);
                setOpen(false);
              }}
              style={hitRow}
            >
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--tag-yellow)", flexShrink: 0 }}>
                {h.part_no}
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.description ?? "—"}
              </span>
              {h.component && (
                <span style={{ color: "var(--ink-dim)", fontSize: 11, flexShrink: 0 }}>{h.component}</span>
              )}
              <span style={{ color: "var(--tag-blue)", flexShrink: 0 }}>+ add</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const partGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "160px 1fr 1fr 28px",
  gap: 8,
  alignItems: "center",
};
const miniHead: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-dim)",
};
const ghostBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  color: "var(--ink-dim)",
  borderRadius: 4,
  padding: "5px 10px",
  fontSize: 12,
  cursor: "pointer",
};
const removeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--ink-dim)",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
};
const saveBtn: React.CSSProperties = {
  background: "var(--tag-yellow)",
  color: "#211f1d",
  border: "none",
  borderRadius: 4,
  padding: "10px 20px",
  fontWeight: 600,
  cursor: "pointer",
};
const catalogTag: React.CSSProperties = {
  position: "absolute",
  right: 6,
  top: 8,
  fontSize: 9,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--tag-blue)",
  pointerEvents: "none",
};
const hitBox: React.CSSProperties = {
  position: "absolute",
  zIndex: 40,
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  overflow: "hidden",
};
const hitRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  width: "100%",
  textAlign: "left",
  border: "none",
  borderBottom: "1px solid var(--border)",
  background: "none",
  color: "var(--ink)",
  fontSize: 13,
  padding: "9px 11px",
  cursor: "pointer",
};
