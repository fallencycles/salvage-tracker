import { getDb } from "@/lib/db";
import { BIKE_STATUSES } from "@/lib/statusFlow";
import { StatusSelect } from "./StatusSelect";
import Link from "next/link";

export async function StageBoard({ status, title }: { status: string; title: string }) {
  const db = getDb();
  const result = await db.query(
    "select * from bikes where status = $1 order by created_at asc",
    [status]
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{title}</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        {result.rows.length} bike{result.rows.length === 1 ? "" : "s"} at this stage
      </p>
      {result.rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)" }}>Nothing here right now.</p>
      ) : (
        <table className="board-table">
          <thead>
            <tr>
              <th>Stock #</th>
              <th>Bike</th>
              <th>Purchased</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((bike) => (
              <tr key={bike.stock_number}>
                <td>
                  <Link href={`/bikes/${bike.stock_number}`} className="stock-tag">
                    #{bike.stock_number}
                  </Link>
                </td>
                <td>
                  {bike.year} {bike.make} {bike.model}
                </td>
                <td>{bike.purchase_date ? new Date(bike.purchase_date).toLocaleDateString() : "—"}</td>
                <td>
                  <StatusSelect
                    entity="bikes"
                    id={bike.stock_number}
                    current={bike.status}
                    options={BIKE_STATUSES}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
