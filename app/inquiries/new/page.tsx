import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { catalogModels } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function NewInquiryPage() {
  const models = await catalogModels();

  return (
    <div>
      <Link href="/inquiries" style={{ fontSize: 13, color: "var(--ink-dim)", textDecoration: "none" }}>
        ← Dashboard
      </Link>
      <h1 style={{ fontSize: 22, margin: "8px 0 4px" }}>New inquiry</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Log what a customer needs while you're on the call. Contact details, the bike, and every
        part they ask about. Saving resets the form for the next call.
      </p>

      <InquiryForm models={models} />
    </div>
  );
}
