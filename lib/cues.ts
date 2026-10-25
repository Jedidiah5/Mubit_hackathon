/**
 * Kinds of event, by the words that name them. Word overlap alone can't tell
 * an awards dinner from a dinner dance (both "three-course dinner, members,
 * bar please"), so notes and ripple targets match on these first.
 */
export const EVENT_CUES: Record<string, RegExp> = {
  awards:
    /\b(?:awards?|trophy|trophies|prizes?|prize-giving|certificates?|nominees?|of the (?:year|season))\b/i,
  quiz: /\bquiz\w*/i,
  meeting:
    /\b(?:agm|annual general meeting|shareholders?|members'? meeting|vote|elections?)\b/i,
  wedding: /\b(?:wedding|married)\b/i,
  engagement: /\bengagement\b/i,
  christmas: /\b(?:christmas|xmas|festive)\b/i,
  gala: /\b(?:gala|ball|auction)\b/i,
  ceilidh: /\b(?:ceilidh|burns night|st andrew)/i,
  tasting: /\b(?:tasting|sommelier)\b/i,
  launch: /\blaunch\w*/i,
  networking: /\b(?:networking|mixer)\b/i,
  memorial: /\b(?:funeral|wake|memorial|celebration of life)\b/i,
  birthday: /\b(?:birthday|anniversary)\b/i,
  talks: /\b(?:conference|meetup|workshop|training|seminar|keynotes?)\b/i,
  reunion: /\breunion\b/i,
  screening: /\b(?:screening|premiere)\b/i,
  leaving:
    /\b(?:leaving (?:do|party|drinks|bash)|retir(?:e|es|ing|ement)|farewell|send-off)\b/i,
  dating: /\b(?:speed dating|singles)\b/i,
};

/** Every kind of event the text names. */
export function eventCues(text: string): Set<string> {
  const cues = new Set<string>();
  for (const [cue, re] of Object.entries(EVENT_CUES)) {
    if (re.test(text)) cues.add(cue);
  }
  return cues;
}
