import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { bolDocumentSchema } from "@/lib/bolExtraction";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You read freight paperwork for a motorcycle salvage/parts business
(Worldwide Express LTL freight): Bills of Lading, freight quotes, freight invoices
(with itemized charges like FUEL SURCHARGE, RE-CLASS, INSPECTION CHARGE), and bills
of sale for whole bikes. Identify which single document type this is, then fill in
only the matching section with everything visible on the page. Leave fields null
if they aren't on the document — do not guess or invent values. Put anything
illegible or unclear in "notes" instead of guessing.`;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a document to extract." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type || "application/pdf";

  try {
    const { output } = await generateText({
      model: google("gemini-3.6-flash"),
      system: SYSTEM_PROMPT,
      output: Output.object({ schema: bolDocumentSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract everything on this document." },
            { type: "file", data: buffer, mediaType, filename: file.name },
          ],
        },
      ],
    });
    return NextResponse.json(output);
  } catch (err) {
    console.error("engine-sales intake extraction failed", err);
    const message = err instanceof Error ? err.message : "Could not read that document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
