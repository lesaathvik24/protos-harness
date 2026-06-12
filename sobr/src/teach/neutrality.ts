// Ported VERBATIM from hooks/vibezombie-neutrality.sh — same patterns, same
// first-match-wins, same labels. Fork options must read like they were written
// for an anonymous engineer: career/personal-advancement and popularity framing
// are categorically banned, no phrasing escapes.

const CAREER: RegExp[] = [
  /\byour\s+(?:\w+\s+){0,2}(?:background|trajectory|career|portfolio|résumé|goals?)\b/i,
  /portfolio[- ]?(?:ship|standard|target|piece|project|builder)/i,
  /hiring\s+signal/i,
  /\brecruiters?\b/i,
  /aligns?\s+with\s+your\b/i,
  /showcases?\s+(?:your|best|skills?|the\s+\w+\s+skills?)/i,
  /job\s+(?:search|application|market|hunt)/i,
  /for\s+your\s+(?:career|portfolio|job|résumé)/i,
];

const POPULARITY: RegExp[] = [
  /everyone\s+uses?\b/i,
  /most\s+\w+\s+use\b/i,
  /industry[- ]?standard/i,
  /de[- ]?facto/i,
  /\bstandard\s+choice\b/i,
  /widely\s+used\b/i,
  /\b\w+\s+all\s+use\s+it\b/i,
  /popular(?:ity)?\s+(?:choice|option|pick)/i,
  /the\s+go[- ]?to\b/i,
];

/** First contamination found, or null if clean. Same output shape as the hook. */
export function checkNeutrality(texts: string[]): string | null {
  const blob = texts.filter(Boolean).join("\n");
  for (const pattern of CAREER) {
    const match = blob.match(pattern);
    if (match) return `career framing: ${match[0].trim()}`;
  }
  for (const pattern of POPULARITY) {
    const match = blob.match(pattern);
    if (match) return `popularity framing: ${match[0].trim()}`;
  }
  return null;
}
