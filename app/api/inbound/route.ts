import { NextResponse } from "next/server";
import { createAndParseEnquiry } from "@/lib/enquiry-process";

const MAX_BODY = 5000;

type InboundMail = {
  from: string;
  subject: string;
  text: string;
  hasAttachments: boolean;
};

function checkSecret(request: Request): boolean {
  const expected = process.env.INBOUND_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    url.searchParams.get("secret") ??
    request.headers.get("x-inbound-token");
  return token === expected;
}

function attachmentCount(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[]" || trimmed === "null") return 0;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.length : trimmed.length > 0 ? 1 : 0;
    } catch {
      return 1;
    }
  }
  return 0;
}

function formatPostmarkFrom(data: Record<string, unknown>): string {
  if (typeof data.From === "string" && data.From.trim()) return data.From;
  const full = data.FromFull;
  if (full && typeof full === "object") {
    const { Name, Email } = full as { Name?: string; Email?: string };
    if (Email && Name) return `${Name} <${Email}>`;
    if (Email) return Email;
  }
  return "unknown@inbound";
}

function fromPostmark(data: Record<string, unknown>): InboundMail | null {
  // Postmark inbound: From / Subject / TextBody / Attachments
  if (
    !("TextBody" in data) &&
    !("HtmlBody" in data) &&
    !("StrippedTextReply" in data)
  ) {
    return null;
  }

  const text =
    (typeof data.TextBody === "string" && data.TextBody) ||
    (typeof data.StrippedTextReply === "string" && data.StrippedTextReply) ||
    "";

  return {
    from: formatPostmarkFrom(data),
    subject: typeof data.Subject === "string" ? data.Subject : "(no subject)",
    text,
    hasAttachments: attachmentCount(data.Attachments) > 0,
  };
}

function fromResend(data: Record<string, unknown>): InboundMail | null {
  // Resend email.received — body must already be resolved onto the payload
  // (or use the test shape below). Prefer Postmark for TextBody-in-webhook.
  if (data.type !== "email.received") return null;
  const inner = data.data;
  if (!inner || typeof inner !== "object") return null;
  const d = inner as Record<string, unknown>;
  const text =
    (typeof d.text === "string" && d.text) ||
    (typeof d.body === "string" && d.body) ||
    "";
  return {
    from: typeof d.from === "string" ? d.from : "unknown@inbound",
    subject: typeof d.subject === "string" ? d.subject : "(no subject)",
    text,
    hasAttachments: attachmentCount(d.attachments) > 0,
  };
}

function fromGeneric(data: Record<string, unknown>): InboundMail | null {
  const text =
    (typeof data.text === "string" && data.text) ||
    (typeof data.body === "string" && data.body) ||
    (typeof data.TextBody === "string" && data.TextBody) ||
    "";
  if (!text && !data.from && !data.From) return null;
  return {
    from:
      (typeof data.from === "string" && data.from) ||
      (typeof data.From === "string" && data.From) ||
      "unknown@inbound",
    subject:
      (typeof data.subject === "string" && data.subject) ||
      (typeof data.Subject === "string" && data.Subject) ||
      "(no subject)",
    text,
    hasAttachments:
      attachmentCount(data.attachments) > 0 ||
      attachmentCount(data.Attachments) > 0,
  };
}

async function readPayload(
  request: Request,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const out: Record<string, unknown> = {};
    form.forEach((value, key) => {
      out[key] = typeof value === "string" ? value : value.name;
    });
    return out;
  }

  // Default: try JSON, then form
  const raw = await request.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(raw);
    const out: Record<string, unknown> = {};
    params.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
}

export async function POST(request: Request) {
  if (!checkSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readPayload(request);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const mail =
    fromPostmark(payload) ?? fromResend(payload) ?? fromGeneric(payload);

  if (!mail) {
    return NextResponse.json(
      { error: "Unrecognized inbound payload" },
      { status: 400 },
    );
  }

  if (mail.hasAttachments) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "attachments",
    });
  }

  const body = mail.text.trim();
  if (!body) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "empty_body",
    });
  }

  if (body.length > MAX_BODY) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "body_too_long",
      length: body.length,
    });
  }

  try {
    const result = await createAndParseEnquiry({
      from: mail.from,
      subject: mail.subject,
      body,
    });
    if (!result.spec) {
      // Stored but unparsed — 200 so the sender doesn't retry and duplicate it.
      return NextResponse.json({
        ok: true,
        enquiryId: result.id,
        parsed: false,
        error: result.error,
      });
    }
    return NextResponse.json({
      ok: true,
      enquiryId: result.id,
      parsed: true,
      requestId: result.requestId,
      guests: result.spec.guests,
      style: result.spec.style,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Inbound processing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
