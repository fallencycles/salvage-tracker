import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isValidPartStatus } from "@/lib/statusFlow";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partId: string }> }
) {
  const { partId } = await params;
  const { status, note } = await req.json();
  if (!isValidPartStatus(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const user = await getCurrentUser();
  const db = getDb();

  const current = await db.query("select status from parts where id = $1", [partId]);
  if (current.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const fromStatus = current.rows[0].status;

  const updated = await db.query(
    "update parts set status = $1, updated_at = now() where id = $2 returning *",
    [status, partId]
  );

  await db.query(
    `insert into status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
     values ('part', $1, $2, $3, $4, $5)`,
    [partId, fromStatus, status, user?.id ?? null, note ?? null]
  );

  return NextResponse.json(updated.rows[0]);
}
