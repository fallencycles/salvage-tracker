import { BentoGrid, BentoCard, BentoCardTitle, BentoCardLabel } from "@/components/Bento";

const TOOLS = [
  { href: "/engine-sales/shipments", title: "Shipments", label: "Dashboard — in transit, open invoices, reconciliation flags" },
  { href: "/engine-sales/intake", title: "Document Intake", label: "Upload a BOL, quote, invoice, or bill of sale" },
  { href: "/engine-sales/orders", title: "eBay Order Intake", label: "Upload an order details page, incl. handwritten notes" },
  { href: "/engine-sales/bill-of-sale/new", title: "New Bill of Sale", label: "Create + print a bill of sale for a customer" },
  { href: "/engine-sales/reports", title: "Reports", label: "Freight spend, quote-vs-actual variance, CSV export" },
  { href: "/engine-sales/schema", title: "Schema", label: "bol_shipment, bol_quote, bol_invoice, bol_bill_of_sale, ..." },
];

export default function EngineSalesPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Engine Sales</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 24 }}>
        Freight shipping, Bills of Lading, and bills of sale for whole bikes/engines sold
        outside the standard listings pipeline.
      </p>

      <BentoGrid columns={3}>
        {TOOLS.map((tool) => (
          <BentoCard key={tool.href} href={tool.href}>
            <BentoCardTitle>{tool.title}</BentoCardTitle>
            <BentoCardLabel>{tool.label}</BentoCardLabel>
          </BentoCard>
        ))}
      </BentoGrid>
    </div>
  );
}
