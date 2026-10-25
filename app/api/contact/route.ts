import { NextResponse, after } from "next/server";
import { createEnquiry, parseEnquiry } from "@/lib/enquiry-process";

const MAX_BODY = 5000;
const MIN_BODY = 10;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

type ContactForm = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  /** Honeypot — hidden from people, bots fill it in. */
  website?: unknown;
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Public venue contact form → enquiries/{id}, parsed after the response. */
export async function POST(request: Request) {
  let form: ContactForm;
  try {
    form = (await request.json()) as ContactForm;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Pretend it worked so bots don't learn to skip the field.
  if (str(form.website)) return NextResponse.json({ ok: true });

  // Angle brackets / newlines would break the "Name <email>" From line.
  const name = str(form.name).replace(/[<>\r\n]/g, "").slice(0, 100);
  const email = str(form.email).slice(0, 200);
  const message = str(form.message);

  if (!name) {
    return NextResponse.json({ error: "Please add your name." }, { status: 400 });
  }
  if (!EMAIL.test(email)) {
    return NextResponse.json(
      { error: "Please add a valid email so we can reply." },
      { status: 400 },
    );
  }
  if (message.length < MIN_BODY) {
    return NextResponse.json(
      { error: "Tell us a little about your event." },
      { status: 400 },
    );
  }
  if (message.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Please keep it under ${MAX_BODY} characters.` },
      { status: 400 },
    );
  }

  let id: string;
  try {
    id = await createEnquiry({
      from: `${name} <${email}>`,
      subject: `Website enquiry from ${name}`,
      body: message,
      source: "contact",
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Could not save";
    return NextResponse.json({ error }, { status: 502 });
  }

  // The LLM call takes seconds; the customer shouldn't wait on it. A failure
  // leaves the enquiry unparsed in the inbox for "Process all".
  after(() => parseEnquiry(id, message));

  return NextResponse.json({ ok: true });
}
