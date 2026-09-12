// Builds the customer tracking email as plain strings — no send logic here.
// See app/api/engine-sales/shipments/[id]/email/route.ts for why: real
// delivery is deliberately not wired yet (needs a provider decision via the
// Vercel marketplace flow), so this stays a pure template function that's
// easy to test and reuse regardless of how sending eventually happens.

const CARRIER_TRACKING_URLS: Record<string, string> = {
  "worldwide express": "https://www.worldwideexpress.com/tracking",
};

function trackingUrlFor(carrier: string | null | undefined): string | null {
  if (!carrier) return null;
  return CARRIER_TRACKING_URLS[carrier.trim().toLowerCase()] ?? null;
}

export type ShipmentForEmail = {
  customer_name?: string | null;
  customer_email?: string | null;
  carrier?: string | null;
  pro_number?: string | null;
  bol_number?: string | null;
  special_instructions?: string | null;
  delivery_instructions?: string | null;
};

export function buildTrackingEmail(shipment: ShipmentForEmail): {
  to: string;
  subject: string;
  body: string;
} {
  const carrier = shipment.carrier ?? "our freight carrier";
  const trackingUrl = trackingUrlFor(shipment.carrier);

  const subject = shipment.pro_number
    ? `Your engine is on its way — ${carrier} PRO# ${shipment.pro_number}`
    : `Your engine is on its way — shipped via ${carrier}`;

  const lines = [
    `Hi ${shipment.customer_name ?? "there"},`,
    "",
    `Your engine has shipped with ${carrier}.`,
    shipment.pro_number ? `PRO number: ${shipment.pro_number}` : null,
    shipment.bol_number ? `BOL number: ${shipment.bol_number}` : null,
    trackingUrl ? `Track it here: ${trackingUrl}` : null,
    shipment.delivery_instructions ? `\nDelivery notes: ${shipment.delivery_instructions}` : null,
    shipment.special_instructions ? `Additional notes: ${shipment.special_instructions}` : null,
    "",
    "Thanks for your business,",
    "Fallen Cycles",
  ].filter((l) => l !== null);

  return {
    to: shipment.customer_email ?? "",
    subject,
    body: lines.join("\n"),
  };
}
