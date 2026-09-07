"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StatusSelect({
  entity,
  id,
  current,
  options,
}: {
  entity: "bikes" | "parts";
  id: string;
  current: string;
  options: readonly string[];
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleChange(next: string) {
    if (next === current) return;
    setPending(true);
    await fetch(`/api/${entity}/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      style={{
        background: "var(--panel-raised)",
        color: "var(--ink)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "4px 8px",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
