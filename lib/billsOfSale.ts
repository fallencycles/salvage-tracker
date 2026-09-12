import { getDb } from "@/lib/db";
import { logActivity } from "@/lib/bolShipments";

export type BillOfSaleInput = {
  shipment_id?: number | null;
  sale_date?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_contact?: string | null;
  item_description?: string | null;
  vin?: string | null;
  serial_number?: string | null;
  mileage?: string | null;
  item_price?: number | null;
  shipping?: number | null;
  sales_tax?: number | null;
  total?: number | null;
};

export type BillOfSale = BillOfSaleInput & {
  id: number;
  created_at: string;
  shipment_id: number | null;
};

const clean = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function createBillOfSale(
  input: BillOfSaleInput,
  opts: { actor?: string | null } = {}
): Promise<BillOfSale> {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("begin");

    const result = await client.query(
      `insert into bol_bill_of_sale
        (shipment_id, sale_date, customer_name, customer_address, customer_contact, item_description,
         vin, serial_number, mileage, item_price, shipping, sales_tax, total)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning *`,
      [
        input.shipment_id ?? null,
        clean(input.sale_date),
        clean(input.customer_name),
        clean(input.customer_address),
        clean(input.customer_contact),
        clean(input.item_description),
        clean(input.vin),
        clean(input.serial_number),
        clean(input.mileage),
        num(input.item_price),
        num(input.shipping),
        num(input.sales_tax),
        num(input.total),
      ]
    );
    const billOfSale = result.rows[0];

    if (billOfSale.shipment_id) {
      await logActivity(
        billOfSale.shipment_id,
        "bill_of_sale_created",
        { actor: opts.actor, bill_of_sale_id: billOfSale.id },
        client
      );
    }

    await client.query("commit");
    return billOfSale;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function getBillOfSale(id: number): Promise<BillOfSale | null> {
  const db = getDb();
  const result = await db.query("select * from bol_bill_of_sale where id = $1", [id]);
  return result.rows[0] ?? null;
}
