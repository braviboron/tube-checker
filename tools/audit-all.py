#!/usr/bin/env python3
"""Per-test audit: for every row in tests.csv, compare current data against
rcpa_specimen and propose changes to tube, tube_alts, note, and nonblood status.
Outputs a structured file used by apply-audit.py to write changes back.

Usage:
  python tools/audit-all.py            # writes tools/rcpa-cache/_per_test_audit.txt
  python tools/audit-all.py --letter A # only letter A (for spot-checking)
"""
import csv, re, sys, argparse
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

CSV = 'data/tests.csv'

# ─── tube detection from specimen text ───────────────────────────────────────
# Maps pattern → our tube key. Order matters (more specific first).
TUBE_PATS = [
    ('blue',      r'\bcitrat'),
    ('grey',      r'fluoride|oxalate'),
    ('royalblue', r'trace element|trace-element|royal blue|navy'),
    ('acd',       r'\bacd\b'),
    ('green',     r'lithium heparin|li heparin|sodium heparin(?! tube for trace)'),
    ('purple',    r'\bedta\b'),
    ('pink',      r'blood bank|group\s*(?:and|&)\s*(?:hold|save|screen|cross)|transfus'),
    ('gold',      r'\bsst\b|serum tube|clotted|plain tube|without anticoagulant|'
                  r'serum.*tube|tube.*serum'),
]
NONBLOOD_FIRST60_RE = re.compile(
    r'\b(urine|faeces|faecal|stool|csf|cerebrospinal|swab|biopsy|'
    r'tissue|calculus|calculi|amniotic|saliva|salivary|sweat|breath|expired air|'
    r'aspirate|scraping|nail|hair|sputum|semen|skin|fluid|random urine|timed urine)\b', re.I)
BLOOD_RE = re.compile(r'\bblood\b', re.I)
# Specimen texts that START with a non-blood collection (e.g. "5 g faeces; ...also blood") –
# the "blood" mention is incidental; don't reclassify away from nonblood.
NONBLOOD_ANCHOR_RE = re.compile(
    r'^(random\b|timed\b|\d+\s*g?\s*faec|\bfaec|\bstool|\burine|\bswab|'
    r'\bcsf\b|cerebrospinal|amniotic|expired air|calcul|tissue|biopsy)', re.I)
# Tubes that should never be auto-changed by generic RCPA wording
PROTECTED_TUBES = {'royalblue', 'pink', 'abg'}  # trace-element, transfusion, ABG
HANDLING_RE = re.compile(
    r'(on ice|melting ice|ice immediately|placed on ice|chilled|'
    r'pre-?cool|pre-?chill|\bfrozen\b|freeze|snap froz|protect.{0,12}light|'
    r'wrap.{0,8}foil|37\s*[\xb0°]?\s*c\b|kept warm|transport warm|warm at|'
    r'do not refrigerate|do not.{0,10}ice|separated immediately|separate immediately|'
    r'assayed.{0,15}immediately)', re.I)

def tubes_from_text(text):
    found = []
    for key, pat in TUBE_PATS:
        if re.search(pat, text, re.I) and key not in found:
            found.append(key)
    return found

# extract the primary sentence(s) that specify the blood collection tube
def primary_phrases(sp):
    # sentences containing "blood in" or "added to ... citrate"
    sens = re.split(r'(?<=[.;])\s+', sp)
    primary = [s for s in sens if re.search(r'blood\s+in|blood added|added to.*citrat|\bEDTA\b|\bcitrat', s, re.I)]
    return ' '.join(primary) if primary else sp[:200]

def handling_snippets(sp):
    snips = []
    for m in HANDLING_RE.finditer(sp):
        start = max(0, m.start()-30)
        snips.append(sp[start:m.start()+50].strip())
    return snips

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--letter')
    a = ap.parse_args()

    rows = list(csv.DictReader(open(CSV, newline='', encoding='utf-8')))

    lines = []
    def w(*args): lines.append(' '.join(str(x) for x in args))

    for r in rows:
        name  = r['name']
        if a.letter and not name.upper().startswith(a.letter.upper()):
            continue
        tube  = r['tube']
        note  = r.get('note','').strip()
        sp    = r.get('rcpa_specimen','').strip()
        kw    = r.get('rcpa_keywords','').strip()
        alts_existing = r.get('tube_alts','').strip()

        w(f'\n### {name}')
        w(f'  current_tube:  {tube}')
        w(f'  current_note:  {note or "(empty)"}')
        if alts_existing:
            w(f'  current_alts:  {alts_existing}')
        w(f'  rcpa_keywords: {kw or "(none)"}')
        w(f'  rcpa_specimen: {sp or "(no specimen field)"}')

        changes = []

        if not sp:
            w('  → NO RCPA SPECIMEN — manual review needed')
            w(f'  CHANGE: none')
            continue

        primary = primary_phrases(sp)
        rcpa_tubes = tubes_from_text(primary)
        if not rcpa_tubes:
            rcpa_tubes = tubes_from_text(sp[:250])
        # also collect alternates from full text
        all_rcpa_tubes = tubes_from_text(sp[:400])

        # ─── nonblood classification ──────────────────────────────────────
        is_nonblood_sp = (NONBLOOD_FIRST60_RE.search(sp[:60])
                         and not BLOOD_RE.search(sp[:60]))
        # Also anchor: specimen that STARTS with faeces/urine/swab wording is nonblood
        # even if "blood" appears later in the text (e.g. "also perform occult blood")
        is_nonblood_anchor = bool(NONBLOOD_ANCHOR_RE.search(sp[:80]))

        if tube == 'nonblood' and rcpa_tubes and not is_nonblood_sp and not is_nonblood_anchor:
            # we said nonblood but RCPA has a blood tube
            preferred = rcpa_tubes[0]
            rest = [t for t in rcpa_tubes[1:] if t != preferred]
            changes.append(('tube', preferred))
            if rest:
                changes.append(('tube_alts', '|'.join(rest)))
            changes.append(('verified', 'rcpa-reviewed'))
            w(f'  ⚠ NONBLOOD→BLOOD  rcpa says: {"/".join(rcpa_tubes)}')
        elif tube != 'nonblood' and tube not in ('confirm','abg') and '|' not in tube:
            # blood test — check tube match; never auto-change protected tubes
            if rcpa_tubes and tube not in rcpa_tubes and tube not in PROTECTED_TUBES:
                preferred = rcpa_tubes[0]
                rest = [t for t in all_rcpa_tubes if t != preferred]
                changes.append(('tube', preferred))
                if rest:
                    changes.append(('tube_alts', '|'.join(rest)))
                changes.append(('verified', 'rcpa-reviewed'))
                w(f'  ⚠ TUBE MISMATCH  ours={tube}  rcpa={"/".join(rcpa_tubes)}')
            else:
                # tube matches (or is protected) — check for unrecorded alternatives
                new_alts = [t for t in all_rcpa_tubes if t != tube and t not in (alts_existing or '').split('|')]
                if new_alts:
                    combined = list(filter(None,(alts_existing or '').split('|'))) + new_alts
                    changes.append(('tube_alts', '|'.join(combined)))
                    w(f'  ℹ ALT TUBES  {"/".join(new_alts)} also acceptable per RCPA')

        # ─── handling note ────────────────────────────────────────────────
        snips = handling_snippets(sp)
        if snips and not note:
            # Use the full rcpa_specimen as the note (verbatim, capped to avoid bloat)
            new_note = sp.strip()
            changes.append(('note', new_note))
            changes.append(('verified', 'rcpa-reviewed'))
            w(f'  ⚠ HANDLING  note empty but specimen says: {" | ".join(snips[:3])}')
        elif snips and note:
            w(f'  ✓ HANDLING  note exists; rcpa also mentions: {snips[0][:60]}')

        # ─── verified status ──────────────────────────────────────────────
        if r.get('verified','') == 'rcpa-index' and not changes:
            changes.append(('verified', 'rcpa-reviewed'))

        if changes:
            for field, val in changes:
                w(f'  CHANGE: {field} = {val[:120]}')
        else:
            w(f'  ✓ OK — no changes needed')

    out = '\n'.join(lines)
    with open('tools/rcpa-cache/_per_test_audit.txt','w',encoding='utf-8') as f:
        f.write(out)
    print(out[:4000] if a.letter else f'Wrote tools/rcpa-cache/_per_test_audit.txt ({len(lines)} lines)')

if __name__ == '__main__':
    main()
