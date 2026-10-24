import { formatGbp, type Quote } from "./quote";
import type { Enquiry, Feasibility, Spec } from "./types";

function firstName(from: string): string {
  const name = from.split("<")[0]?.trim() ?? from;
  const first = name.split(/\s+/)[0]?.replace(/[^a-zA-Z'-]/g, "");
  return first || "there";
}

function stylePhrase(style: Spec["style"]): string {
  switch (style) {
    case "banquet":
      return "banquet-style";
    case "cabaret":
      return "cabaret-style";
    case "theatre":
      return "theatre-style";
    case "reception":
      return "reception-style";
  }
}

export type DraftReplyOpts = {
  quote?: Quote | null;
  /** Absolute URL to the public floor plan, e.g. https://host/p/enq-1 */
  planUrl?: string;
};

/** Code-templated client reply — no LLM. */
export function draftReply(
  enquiry: Pick<Enquiry, "from" | "subject">,
  spec: Spec,
  feasibility: Feasibility,
  opts: DraftReplyOpts = {},
): string {
  const name = firstName(enquiry.from);
  const room = feasibility.room?.name ?? "a suitable room";
  const style = stylePhrase(spec.style);
  const keyExtras = spec.extras
    .filter((e) => e !== "lectern")
    .map((e) => e.replace(/_/g, " "));
  const extras =
    keyExtras.length > 0 ? `, including ${keyExtras.join(", ")}` : "";

  const quoteLine = opts.quote
    ? `\nEstimated total ${formatGbp(opts.quote.total)} inc. VAT.`
    : "";
  const planLine = opts.planUrl
    ? `\nYour floor plan: ${opts.planUrl}`
    : "";

  if (feasibility.status === "cannot") {
    const reason =
      feasibility.notes.find((n) => /over capacity|step-free|AV|stage/i.test(n)) ??
      feasibility.notes[0] ??
      "it exceeds what we can host";
    return `Hi ${name},

Thanks for getting in touch about "${enquiry.subject}".

Unfortunately we can't host this as specified — ${reason}. Closest option on our side is ${room} (capacity ${feasibility.capacity} for ${spec.style}). Happy to discuss a smaller guest count or a different format.

Best regards,
The Wharf Rooms`;
  }

  const cautionNotes = feasibility.notes
    .filter((n) => !/−\d|capacity$/i.test(n))
    .slice(0, 2);
  const caution =
    feasibility.status === "warning"
      ? `\n\nOne note: ${cautionNotes.join("; ") || "we may need a small adjustment on the day"}.`
      : "";

  return `Hi ${name},

Thanks for your enquiry. ${room} works for ${spec.guests} guests ${style}${extras}.${quoteLine}${planLine}${caution}

Happy to hold provisional dates — reply to this email to confirm.

Best regards,
The Wharf Rooms`;
}
