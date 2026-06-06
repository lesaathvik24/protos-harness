#!/usr/bin/env bash
# vibezombie neutrality gate — scans AskUserQuestion option text for contamination
# while learning mode is active, so fork options stay engineering-only regardless of
# what sits in the user's CLAUDE.md / memory. The prompt rule is the first line of
# defense; this hook is the backstop that ships with the skill and protects any installer.
# Scope is per-SESSION (see vibezombie-gate.sh): only fires in the session that ran
# /vibezombie. No session id, or mode off for this session → allow silently.
# State dir overridable via VIBEZOMBIE_DIR (tests).
set -uo pipefail

VZ_DIR="${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}"

INPUT=$(cat)

# Resolve the session id from the hook payload (sanitized for filesystem safety).
SID=$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    s = json.load(sys.stdin).get("session_id", "")
except Exception:
    s = ""
print("".join(c for c in str(s) if c.isalnum() or c in "._-"))
' 2>/dev/null || true)

# No scope, or mode off for THIS session → allow silently (never touch normal work or
# other skills' questions).
[[ -n "$SID" ]] || exit 0
[[ -f "$VZ_DIR/sessions/$SID/active" ]] || exit 0

HIT=$(printf '%s' "$INPUT" | python3 -c '
import sys, json, re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

texts = []
for q in data.get("questions", []) or []:
    if not isinstance(q, dict):
        continue
    texts.append(q.get("question", "") or "")
    for o in q.get("options", []) or []:
        if isinstance(o, dict):
            texts.append(o.get("label", "") or "")
            texts.append(o.get("description", "") or "")
blob = "\n".join(t for t in texts if t)

# Career / personal-advancement framing — a neutral technical option never addresses
# the user as a job-seeker. Targets advancement phrasing, not domain nouns.
career = [
    r"\byour\s+(?:\w+\s+){0,2}(?:background|trajectory|career|portfolio|résumé|goals?)\b",
    r"portfolio[- ]?(?:ship|standard|target|piece|project|builder)",
    r"hiring\s+signal",
    r"\brecruiters?\b",
    r"aligns?\s+with\s+your\b",
    r"showcases?\s+(?:your|best|skills?|the\s+\w+\s+skills?)",
    r"job\s+(?:search|application|market|hunt)",
    r"for\s+your\s+(?:career|portfolio|job|résumé)",
]
# Popularity / bandwagon framing — banned regardless of truth.
popularity = [
    r"everyone\s+uses?\b",
    r"most\s+\w+\s+use\b",
    r"industry[- ]?standard",
    r"de[- ]?facto",
    r"\bstandard\s+choice\b",
    r"widely\s+used\b",
    r"\b\w+\s+all\s+use\s+it\b",
    r"popular(?:ity)?\s+(?:choice|option|pick)",
    r"the\s+go[- ]?to\b",
]

for pat in career:
    m = re.search(pat, blob, re.I)
    if m:
        print("career framing: " + m.group(0).strip())
        sys.exit(0)
for pat in popularity:
    m = re.search(pat, blob, re.I)
    if m:
        print("popularity framing: " + m.group(0).strip())
        sys.exit(0)
' 2>/dev/null || true)

if [[ -n "$HIT" ]]; then
  echo "BLOCKED: vibezombie neutrality — option text carries $HIT. Fork descriptions must be engineering tradeoffs ONLY (no career/personal-advancement or popularity framing). Rewrite for an anonymous engineer and re-ask." >&2
  exit 2
fi

exit 0
