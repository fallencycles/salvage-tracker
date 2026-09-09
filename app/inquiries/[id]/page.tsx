import Link from "next/link";
import { notFound } from "next/navigation";
import { InquiryForm, type ModelOption, type InitialInquiry } from "@/components/InquiryForm";
import { catalogModels } from "@/lib/catalog";
import { getInquiry, formatReceivedAt } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

export default async function EditInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const idNum = Number((await params).id);
  if (!Number.isInteger(idNum) || idNum <= 0) notFound();

  const [models, inquiry] = await Promise.all([catalogModels(), getInquiry(idNum)]);
  if (!inquiry) notFound();

  const seen = new Set<string>();
  const modelOptions: ModelOption[] = [];
  for (const m of models) {
    if (!m.name || seen.has(m.name)) continue;
    seen.add(m.name);
    modelOptions.push({ name: m.name, family: m.family });
  }
  modelOptions.sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

  const initial: InitialInquiry = {
    id: inquiry.id,
    customer_name: inquiry.customer_name,
    phone: inquiry.phone,
    email: inquiry.email,
    company: inquiry.company,
    moto_year: inquiry.moto_year,
    moto_make: inquiry.moto_make,
    moto_model: inquiry.moto_model,
    taken_by: inquiry.taken_by,
    notes: inquiry.notes,
    status: inquiry.status,
    parts: inquiry.parts.map((p) => ({
      id: p.id,
      oem_part_number: p.oem_part_number,
      description: p.description,
      qty: p.qty,
      notes: p.notes,
      source: p.source,
      catalog_part_no: p.catalog_part_no,
    })),
  };

  return (
    <div>
      <Link href="/inquiries" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
        ← All inquiries
      </Link>
      <h1 style={{ fontSize: 22, margin: "8px 0 2px" }}>
        Edit inquiry #{inquiry.id}
      </h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20, fontSize: 13 }}>
        Logged {formatReceivedAt(inquiry.created_at)}
      </p>

      <InquiryForm models={modelOptions} initial={initial} />
    </div>
  );
}
