#!/usr/bin/env python3
"""Read data/tests.csv (with rcpa_specimen captured) and produce an audit worklist:
  1. TUBE MISMATCH  - our `tube` is not among the tube(s) RCPA's specimen text allows
  2. TUBE ALTS      - alternative acceptable tubes derived from "X or Y tube" wording
  3. MISSING HANDLING - specimen says ice/frozen/light/warm but our `note` is empty
  4. NONBLOOD CHECK - our tube vs whether RCPA specimen looks like blood / non-blood

Heuristic + advisory only. Nothing is written; this prints a report for review.
"""
import csv, re, sys
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

CSV = 'data/tests.csv'

# tube-phrase -> our tube key, tested against the PRIMARY collection phrase
TUBEPATS = [
    ('blue',      r'citrat'),
    ('grey',      r'fluoride|oxalate'),
    ('royalblue', r'trace element|trace-element|royal blue'),
    ('acd',       r'\bacd\b'),
    ('green',     r'lithium heparin|li heparin|\bheparin'),
    ('purple',    r'\bedta\b'),
    ('gold',      r'sst|serum|clotted|plain tube|without anticoagulant'),
]
NONBLOOD_RE = re.compile(r'\b(urine|faeces|faecal|stool|csf|cerebrospinal|swab|biopsy|'
    r'tissue|calculus|calculi|amniotic|saliva|salivary|sweat|breath|expired air|'
    r'aspirate|scraping|nail|hair|sputum|semen|fluid)\b', re.I)
HANDLING_RE = re.compile(r'(on ice|melting ice|ice immediately|placed on ice|chilled|'
    r'pre-?cool|pre-?chill|frozen|freeze|snap froz|protect.{0,8}light|wrap.{0,8}foil|'
    r'37\s*\xb0?c|kept warm|transport warm|warm at)', re.I)

def primary_phrase(sp):
    """The tube(s) named in the main collection sentence."""
    m = re.search(r'blood\s+(?:added to|in)\s+(?:a |an |the |[\d.]+\s*ml\s+)?(.*?)\s*'
                  r'(?:tube|syringe|bottle)\b', sp, re.I)
    if m: return m.group(1)
    m = re.search(r'added to\s+[\d.]+\s*ml\s+(citrate)', sp, re.I)   # coag wording
    if m: return m.group(1)
    return ''

def tubes_from(phrase):
    found = []
    for key, pat in TUBEPATS:
        if re.search(pat, phrase, re.I) and key not in found:
            found.append(key)
    return found

def main():
    rows = list(csv.DictReader(open(CSV, newline='', encoding='utf-8')))
    mism, alts, handling, nbcheck = [], [], [], []
    for r in rows:
        name, ours = r['name'], r['tube']
        sp = r.get('rcpa_specimen', '').strip()
        note = r.get('note', '').strip()
        if not sp:
            continue
        # skip the AND-case and special pseudo-tubes for mismatch logic
        special = ours in ('confirm', 'abg', 'nonblood') or '|' in ours
        phrase = primary_phrase(sp)
        rset = tubes_from(phrase) or tubes_from(sp[:160])
        looks_nonblood = bool(NONBLOOD_RE.search(sp[:60])) and not re.search(r'blood', sp[:60], re.I)

        # 4. nonblood disagreement
        if ours == 'nonblood' and rset and not looks_nonblood:
            nbcheck.append((name, ours, '/'.join(rset), sp[:70]))
        if ours != 'nonblood' and looks_nonblood and not rset:
            nbcheck.append((name, ours, 'NONBLOOD?', sp[:70]))

        if special or not rset:
            pass
        else:
            # 1. mismatch: our tube not acceptable per RCPA
            if ours not in rset:
                mism.append((name, ours, '/'.join(rset), sp[:85]))
            # 2. alternatives: RCPA lists more than one and ours is among them
            elif len(rset) > 1:
                others = [t for t in rset if t != ours]
                alts.append((name, ours, '|'.join(others)))
        # 3. missing handling
        if HANDLING_RE.search(sp) and not note:
            m = HANDLING_RE.search(sp)
            handling.append((name, ours, sp[max(0,m.start()-25):m.start()+45]))

    def dump(title, rows_, cols):
        print(f"\n{'='*72}\n{title}  ({len(rows_)})\n{'='*72}")
        for t in rows_:
            print('  ' + ' | '.join(str(x) for x in t)[:160])

    dump('1. TUBE MISMATCH  (ours not in RCPA-allowed set)  name|ours|rcpa|specimen', mism, 4)
    dump('3. MISSING HANDLING  (ice/frozen/light/warm in specimen, note empty)  name|tube|context', handling, 3)
    dump('4. NONBLOOD CHECK  (classification disagreement)  name|ours|rcpa|specimen', nbcheck, 4)
    dump('2. TUBE ALTS derived (sample of first 30)  name|preferred|alts', alts[:30], 3)
    print(f"\nSUMMARY: mismatches={len(mism)}  missing-handling={len(handling)}  "
          f"nonblood-check={len(nbcheck)}  alts-derived={len(alts)}")

if __name__ == '__main__':
    main()
