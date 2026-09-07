import { getDb } from "@/lib/db";
import { BIKE_STATUSES } from "@/lib/statusFlow";
import Link from "next/link";

const STAGE_LINKS: Record<string, string> = {
  intake: "/intake",
  teardown: "/teardown",
  cataloged: "/cataloging",
  detailing: "/detailing",
  photo_ready: "/photography",
  listed: "/listings",
  partial_sold: "/orders",
  closed: "/orders",
};

export default async function OverviewPage() {
  const db = getDb();
  const counts = await db.query(
    "select status, count(*)::int as count from bikes group by status"
  );
  const countMap = Object.fromEntries(counts.rows.map((r) => [r.status, r.count]));

  const returns = await db.query("select count(*)::int as count from returns where status != 'closed'");
  const openReturns = returns.rows[0].count;

  const awaitingShip = await db.query(
    "select count(*)::int as count from orders where shipping_status = 'awaiting_shipment'"
  );
  const ordersToShip = awaitingShip.rows[0].count;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Pipeline overview</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 24 }}>
        Where every bike currently sits, by stage.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {BIKE_STATUSES.map((status) => (
          <Link
            key={status}
            href={STAGE_LINKS[status] ?? "/"}
            style={{
              display: "block",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: 16,
              textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 28, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
              {countMap[status] ?? 0}
            </div>
            <div style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 4 }}>{status}</div>
          </Link>
        ))}
      </div>

      {ordersToShip > 0 && (
        <p style={{ marginTop: 24, color: "var(--tag-yellow)" }}>
          {ordersToShip} order{ordersToShip === 1 ? "" : "s"} waiting to ship —{" "}
          <Link href="/shipping" style={{ textDecoration: "underline" }}>
            view
          </Link>
        </p>
      )}
      {openReturns > 0 && (
        <p style={{ marginTop: 8, color: "var(--tag-rust)" }}>
          {openReturns} open return{openReturns === 1 ? "" : "s"} needing attention —{" "}
          <Link href="/orders" style={{ textDecoration: "underline" }}>
            view
          </Link>
        </p>
      )}
    </div>
  );
}
