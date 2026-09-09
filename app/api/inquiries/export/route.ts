import { listInquiries, inquiriesToCsv } from "@/lib/inquiries";

// Downloads the whole inquiry log as a flat CSV — one row per requested part,
// customer/motorcycle columns repeated, tied together by inquiry_id.
export async function GET() {
  const rows = await listInquiries(100_000);
  const csv = inquiriesToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="customer-inquiries-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
