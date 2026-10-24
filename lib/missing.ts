/**
 * What a quote needs that the email never says. Pure code on the raw email,
 * so it can't hallucinate: the model always fills every field, even for
 * "i want to host a hackathon".
 */
export type MissingDetail = "guests" | "date" | "format";

export const MISSING_LABEL: Record<MissingDetail, string> = {
  guests: "No guest count",
  date: "No date",
  format: "No format (seated, standing, talks?)",
};

/** The question the follow-up email asks for each gap. */
export const MISSING_QUESTION: Record<MissingDetail, string> = {
  guests: "Roughly how many people are you expecting?",
  date: "Which date (or dates) do you have in mind?",
  format:
    "What will happen on the day: a seated meal, standing drinks, talks or presentations, or something else?",
};

const MONTH =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/** Digits that are dates, times, years or money, so not a head count. */
const NOT_A_COUNT = new RegExp(
  [
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH})\\b`,
    `\\b(?:${MONTH})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`,
    "\\b\\d{1,2}(?:st|nd|rd|th)\\b",
    // Not "60-80": a dash between two numbers is a range of guests.
    "\\b\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?\\b",
    "\\b\\d{1,2}-\\d{1,2}-\\d{2,4}\\b",
    "\\b(?:19|20)\\d{2}\\b",
    "\\b\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b",
    "\\b\\d{1,2}:\\d{2}\\b",
    "[£$€]\\s*\\d[\\d,.]*k?",
  ].join("|"),
  "gi",
);

const COUNT =
  /\b\d{1,4}\b|\b(?:ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|dozen|thousand)\b|\b(?:three|four|five|six|seven|eight|nine|eleven)\s+(?:teams|tables|families|couples|people|guests)\b/i;

/** "May" only counts as a month next to a day or "in/early/late May". */
const MONTH_NOT_MAY = MONTH.replace("|may|", "|");

const DATE = new RegExp(
  [
    `\\b(?:${MONTH_NOT_MAY})\\b`,
    "\\b(?:in|of|early|mid|late)[-\\s]+may\\b",
    "\\b\\d{1,2}(?:st|nd|rd|th)?\\s+may\\b",
    "\\bmay\\s+\\d{1,2}\\b",
    "\\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\\b",
    "\\b\\d{1,2}(?:st|nd|rd|th)\\b",
    "\\b\\d{1,2}[/.]\\d{1,2}\\b",
    "\\b(?:tomorrow|tonight|weekend|christmas|easter|new year|spring|summer|autumn|fall|winter)\\b",
    "\\bnext\\s+(?:week|month|year)\\b",
    "\\bq[1-4]\\b",
  ].join("|"),
  "i",
);

/** Words that say how the room is used, or event types that imply it. */
const FORMAT =
  /\b(?:dinner|lunch|breakfast|brunch|meal|food|catering|canap\w*|buffet|seated|sit[-\s]down|standing|drinks|reception|cocktails?|talks?|present\w*|keynote|panel|speech(?:es)?|workshop|conference|seminar|training|meeting|agm|rows|theatre|cabaret|banquet|networking|mixer|social|mingl\w*|danc\w*|ceilidh|disco|dj|band|ceremony|wedding|gala|awards?|prizes?|quiz|supper|tea|nibbles|refreshments|bite to eat|tasting|auction|reading|signing)\b/i;

/** Pass subject and body together: subjects often carry the date. */
export function missingDetails(text: string): MissingDetail[] {
  const missing: MissingDetail[] = [];
  if (!COUNT.test(text.replace(NOT_A_COUNT, " "))) missing.push("guests");
  if (!DATE.test(text)) missing.push("date");
  if (!FORMAT.test(text)) missing.push("format");
  return missing;
}

/**
 * Layout and quote depend on head count and format; a missing date only
 * matters for availability, so it is asked in the reply, not a blocker.
 */
export function needsInfo(missing: MissingDetail[]): boolean {
  return missing.includes("guests") || missing.includes("format");
}

export function enquiryText(e: { subject: string; body: string }): string {
  return `${e.subject}\n${e.body}`;
}
