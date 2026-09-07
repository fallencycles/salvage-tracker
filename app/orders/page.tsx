import { getDb } from "@/lib/db";

export default async function OrdersPage() {
  const db = getDb();
  const orders = await db.query(
    `select o.*, p.part_name, p.stock_number
     from orders o
     join listings l on l.id = o.listing_id
     join parts p on p.id = l.part_id
     order by o.sold_at desc
     limit 100`
  );
  const returns = await db.query(
    `select r.*, o.buyer_name, p.part_name, p.stock_number
     from returns r
     join orders o on o.id = r.order_id
     join listings l on l.id = o.listing_id
     join parts p on p.id = l.part_id
     where r.status != 'closed'
     order by r.created_at desc`
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Orders &amp; Returns</h1>

      <h2 style={{ fontSize: 16, color: "var(--tag-rust)", marginBottom: 10 }}>
        Open returns ({returns.rows.length})
      </h2>
      {returns.rows.length === 0 ? (
        <p style={{ color: "var(--ink-dim)", marginBottom: 28 }}>No open returns.</p>
      ) : (
        <table className="board-table" style={{ marginBottom: 28 }}>
          <thead>
            <tr>
              <th>Stock #</th>
              <th>Part</th>
              <th>Buyer</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {returns.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="stock-tag">#{r.stock_number}</span>
                </td>
                <td>{r.part_name}</td>
                <td>{r.buyer_name}</td>
                <td>{r.reason ?? "—"}</td>
                <td>
                  <span className="status-pill">{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, color: "var(--ink-dim)", marginBottom: 10 }}>Recent orders</h2>
      <table className="board-table">
        <thead>
          <tr>
            <th>Stock #</th>
            <th>Part</th>
            <th>Buyer</th>
            <th>Sale price</th>
            <th>Sold</th>
            <th>Shipping</th>
          </tr>
        </thead>
        <tbody>
          {orders.rows.map((o) => (
            <tr key={o.id}>
              <td>
                <span className="stock-tag">#{o.stock_number}</span>
              </td>
              <td>{o.part_name}</td>
              <td>{o.buyer_name}</td>
              <td>{o.sale_price ? `$${o.sale_price}` : "—"}</td>
              <td>{new Date(o.sold_at).toLocaleDateString()}</td>
              <td>
                <span className="status-pill">{o.shipping_status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
