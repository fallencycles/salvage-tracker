import { getDb } from "@/lib/db";
import { PART_STATUSES } from "@/lib/statusFlow";
import { StatusSelect } from "./StatusSelect";

export async function PartsBoard({ status, title }: { status: string; title: string }) {
  const db = getDb();
  const result = await db.query(
    "select * from parts where status = $1 order by created_at asc",
    [status]
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{title}</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        {result.rows.length} part{result.rows.length === 1 ? "" : "s"} at this stage
      </p>
      {result.rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)" }}>Nothing here right now.</p>
      ) : (
        <table className="board-table">
          <thead>
            <tr>
              <th>Stock #</th>
              <th>Part</th>
              <th>Asking</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((part) => (
              <tr key={part.id}>
                <td>
                  <span className="stock-tag">#{part.stock_number}</span>
                </td>
                <td>{part.part_name}</td>
                <td>{part.asking_price ? `$${part.asking_price}` : "—"}</td>
                <td>
                  <StatusSelect entity="parts" id={part.id} current={part.status} options={PART_STATUSES} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
