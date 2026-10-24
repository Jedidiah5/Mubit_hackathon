/** Frozen. Do not edit, reformat, or interpolate. */
export const PARSE_MODEL = "gpt-6-luna";

/** Frozen. Do not edit, reformat, or interpolate. */
export const PARSE_SYSTEM_PROMPT = `You read event enquiries sent to a venue and extract the room setup.
style: banquet = seated dinner at round tables; cabaret = round tables with seats facing a stage (talks/awards); theatre = rows of chairs facing the front; reception = standing with high tables (drinks, networking).
If an event has drinks then a sit-down meal, choose banquet.
guests: the expected number of people (use the middle of a range).
stage: where a stage/speaking area is needed, else "none". Default wall "north" if needed but unspecified.
bar: "east" if a bar is needed but unspecified, else "none".
extras: only items clearly implied (speeches/awards → lectern; dancing → dance_floor; slides/presentation → projector).
accessible: true if anyone needs step-free or wheelchair access.
Reply with JSON only, no extra text.`;

const MAX_CHARS = 700;

// Counts, people, food, drink, music, dancing, speeches, stage, access, screens.
// Also the seating and format cues the frozen prompt is scored on, so a trim
// cannot strip the sentence that decides style.
const KEEP_SENTENCE =
  /\d|\b(?:people|guests?|food|dinners?|drinks?|meals?|sit-down|music|danc(?:e|ing|es)|speeches|speech|stages?|awards?|talks?|networking|panels?|seated|seating|access(?:ible|ibility)?|wheelchairs?|step[-\s]?free|screens?|presentations?|slides?|projectors?)\b/i;

const GREETING =
  /^(?:hi|hiya|hello|hey|good morning|good afternoon|good evening|to whom it may concern)\b/i;

const DEAR = /^dear\b/i;

const HOPE =
  /^(?:i hope (?:this (?:email|message) finds you well|you(?:'re| are) well)|hope you(?:'re| are) well|hope this finds you well)\b/i;

const SIGN_OFF =
  /^(many thanks|thanks again|thank you(?: so much)?|thanks|kind regards|warm regards|best regards|best wishes|all the best|with (?:best|kind) regards|regards|cheers|sincerely|yours faithfully|yours sincerely|yours|best|speak soon|sent from my \w+|get outlook)\b/i;

function isGreetingLine(line: string): boolean {
  if (KEEP_SENTENCE.test(line) || line.length > 80) return false;
  return GREETING.test(line) || DEAR.test(line) || HOPE.test(line);
}

function isSignOffLine(line: string): boolean {
  if (line === "--" || line === "—") return true;
  if (KEEP_SENTENCE.test(line)) return false;
  const match = line.match(SIGN_OFF);
  if (!match) return false;
  const rest = line
    .slice(match[0].length)
    .replace(/^[,!.\-–—\s]+/, "")
    .replace(/[,!.\-–—\s]+$/, "")
    .trim();
  if (!rest) return true;
  if (/[.?!]/.test(rest)) return false;
  return rest.split(/\s+/).length <= 5;
}

function stripCourtesy(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  let signingOff = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || signingOff) continue;
    if (isGreetingLine(line)) continue;
    if (isSignOffLine(line)) {
      signingOff = true;
      continue;
    }
    kept.push(line);
  }

  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  const slice = text.slice(0, MAX_CHARS);
  const space = slice.lastIndexOf(" ");
  if (space >= MAX_CHARS - 60) return slice.slice(0, space).trim();
  return slice.trim();
}

/**
 * Drop greetings and sign-offs, cap at about 700 characters.
 * Every other sentence is kept: indirect clues ("my nan uses a walker",
 * "there'll be a DJ") don't match any keyword list.
 */
export function trimEnquiry(text: string): string {
  return truncate(stripCourtesy(text));
}
