import { getDb } from "@/lib/db";
import { ShipForm } from "@/components/ShipForm";

export default async function ShippingPage() {
  const db = getDb();

  const awaiting = await db.query(
    `select o.*, p.part_name, p.stock_number
     from orders o
     join listings l on l.id = o.listing_id
     join parts p on p.id = l.part_id
     where o.shipping_status = 'awaiting_shipment'
     order by o.sold_at asc`
  );

  const recent = await db.query(
    `select o.*, p.part_name, p.stock_number
     from orders o
     join listings l on l.id = o.listing_id
     join parts p on p.id = l.part_id
     where o.shipping_status in ('shipped', 'delivered')
     order by o.shipped_at desc nulls last
     limit 50`
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Shipping</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        {awaiting.rows.length} order{awaiting.rows.length === 1 ? "" : "s"} waiting to ship
      </p>

      {awaiting.rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)", marginBottom: 28 }}>Nothing waiting on shipment.</p>
      ) : (
        <table className="board-table" style={{ marginBottom: 28 }}>
          <thead>
            <tr>
              <th>Stock #</th>
              <th>Part</th>
              <th>Buyer</th>
              <th>Sold</th>
              <th>Ship</th>
            </tr>
          </thead>
          <tbody>
            {awaiting.rows.map((o) => (
              <tr key={o.id}>
                <td>
                  <span className="stock-tag">#{o.stock_number}</span>
                </td>
                <td>{o.part_name}</td>
                <td>{o.buyer_name}</td>
                <td>{new Date(o.sold_at).toLocaleDateString()}</td>
                <td>
                  <ShipForm orderId={o.id} currentStatus={o.shipping_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, color: "var(--ink-dim)", marginBottom: 10 }}>Recently shipped</h2>
      {recent.rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)" }}>Nothing shipped yet.</p>
      ) : (
        <table className="board-table">
          <thead>
            <tr>
              <th>Stock #</th>
              <th>Part</th>
              <th>Carrier</th>
              <th>Tracking #</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.rows.map((o) => (
              <tr key={o.id}>
                <td>
                  <span className="stock-tag">#{o.stock_number}</span>
                </td>
                <td>{o.part_name}</td>
                <td>{o.carrier ?? "—"}</td>
                <td>{o.tracking_number ?? "—"}</td>
                <td>
                  <ShipForm orderId={o.id} currentStatus={o.shipping_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
