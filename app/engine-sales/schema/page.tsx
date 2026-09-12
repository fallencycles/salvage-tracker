import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

export default async function EngineSalesSchemaPage() {
  const sql = await readFile(
    path.join(process.cwd(), "migrations", "015_bol_shipments.sql"),
    "utf-8"
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>BOL Shipments migration</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        migrations/015_bol_shipments.sql — applied to the database.
      </p>
      <p style={{ marginTop: -12, marginBottom: 20 }}>
        <Link href="/engine-sales/intake" style={{ textDecoration: "underline" }}>
          Try the document intake tool →
        </Link>
        {" · "}
        <Link href="/engine-sales" style={{ textDecoration: "underline" }}>
          Engine Sales overview
        </Link>
      </p>
      <pre
        style={{
          background: "var(--panel, #111)",
          border: "1px solid var(--border, #333)",
          borderRadius: 8,
          padding: 16,
          overflowX: "auto",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <code>{sql}</code>
      </pre>
    </div>
  );
}
