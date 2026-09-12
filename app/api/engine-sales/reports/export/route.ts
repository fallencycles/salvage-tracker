import { getReconciliationSummary } from "@/lib/bolInvoices";
import { reconciliationToCsv } from "@/lib/bolReports";

export async function GET() {
  const rows = await getReconciliationSummary();
  const csv = reconciliationToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="engine-sales-shipments-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
