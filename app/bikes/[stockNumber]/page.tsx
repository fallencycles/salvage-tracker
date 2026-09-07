import { getDb } from "@/lib/db";
import { PART_STATUSES } from "@/lib/statusFlow";
import { StatusSelect } from "@/components/StatusSelect";
import { notFound } from "next/navigation";

export default async function BikeDetailPage({ params }: { params: Promise<{ stockNumber: string }> }) {
  const { stockNumber } = await params;
  const db = getDb();
  const bikeResult = await db.query("select * from bikes where stock_number = $1", [stockNumber]);
  if (bikeResult.rows.length === 0) notFound();
  const bike = bikeResult.rows[0];

  const parts = await db.query("select * from parts where stock_number = $1 order by created_at", [
    stockNumber,
  ]);
  const history = await db.query(
    "select * from status_history where entity_type = 'bike' and entity_id = $1 order by changed_at desc",
    [stockNumber]
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>
        <span className="stock-tag">#{bike.stock_number}</span> — {bike.year} {bike.make} {bike.model}
      </h1>
      <p style={{ color: "var(--ink-dim)", marginBottom: 24 }}>
        Purchased {bike.purchase_date ? new Date(bike.purchase_date).toLocaleDateString() : "—"} from{" "}
        {bike.purchase_source ?? "unknown source"} · Status: {bike.status}
      </p>

      <h2 style={{ fontSize: 16, color: "var(--ink-dim)", marginBottom: 10 }}>Parts ({parts.rows.length})</h2>
      {parts.rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)" }}>No parts cataloged yet.</p>
      ) : (
        <table className="board-table" style={{ marginBottom: 30 }}>
          <thead>
            <tr>
              <th>Part</th>
              <th>Category</th>
              <th>Asking</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {parts.rows.map((part) => (
              <tr key={part.id}>
                <td>{part.part_name}</td>
                <td>{part.category ?? "—"}</td>
                <td>{part.asking_price ? `$${part.asking_price}` : "—"}</td>
                <td>
                  <StatusSelect entity="parts" id={part.id} current={part.status} options={PART_STATUSES} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, color: "var(--ink-dim)", marginBottom: 10 }}>History</h2>
      <ul style={{ listStyle: "none", padding: 0, fontSize: 13, color: "var(--ink-dim)" }}>
        {history.rows.map((h) => (
          <li key={h.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            {new Date(h.changed_at).toLocaleString()} — {h.from_status ?? "created"} → {h.to_status}
            {h.note ? ` (${h.note})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
