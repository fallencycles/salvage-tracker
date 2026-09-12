import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { ebayOrderSchema } from "@/lib/ebayOrderExtraction";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You read eBay "Order details" pages for a motorcycle salvage/parts
business — often printed out and annotated by hand during a customer-service
investigation (duplicate listings, inventory mismatches, cancellations). Extract every
printed field. Separately, transcribe any handwritten or highlighted notes verbatim into
handwritten_notes — do not paraphrase them or merge them into the printed fields. Leave
fields null if they aren't visible. Do not guess or invent values.`;

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
      output: Output.object({ schema: ebayOrderSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract everything on this order details page." },
            { type: "file", data: buffer, mediaType, filename: file.name },
          ],
        },
      ],
    });
    return NextResponse.json(output);
  } catch (err) {
    console.error("engine-sales orders-intake extraction failed", err);
    const message = err instanceof Error ? err.message : "Could not read that document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
