// The workflow stages, in order. Kept in one place so the UI nav, the API
// validation, and any future reporting all agree on what "next" means.

export const BIKE_STATUSES = [
  "intake",
  "teardown",
  "cataloged",
  "detailing",
  "photo_ready",
  "listed",
  "partial_sold",
  "closed",
] as const;

export const PART_STATUSES = [
  "pending",
  "detailed",
  "photographed",
  "listed",
  "sold",
  "return_pending",
  "returned",
  "refunded",
  "closed",
] as const;

export type BikeStatus = (typeof BIKE_STATUSES)[number];
export type PartStatus = (typeof PART_STATUSES)[number];

// Trust-based system: any status is technically allowed from any status right now
// (a bike/part can get kicked back a stage, e.g. photo_ready -> detailing if a
// part fails inspection). This just validates the value is a real status.
export function isValidBikeStatus(s: string): s is BikeStatus {
  return (BIKE_STATUSES as readonly string[]).includes(s);
}

export function isValidPartStatus(s: string): s is PartStatus {
  return (PART_STATUSES as readonly string[]).includes(s);
}
