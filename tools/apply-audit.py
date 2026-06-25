#!/usr/bin/env python3
"""Read _per_test_audit.txt and apply all CHANGE: lines back to tests.csv.
Also adds tube_alts column if absent. Rewrites the CSV in full (safe pattern).

Usage:
  python tools/apply-audit.py --letter A   # apply only letter A (incremental)
  python tools/apply-audit.py --all        # apply everything
  python tools/apply-audit.py --dry        # print changes, don't write
"""
import csv, re, sys, argparse, os
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

CSV   = 'data/tests.csv'
AUDIT = 'tools/rcpa-cache/_per_test_audit.txt'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--letter')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()

    # parse the audit file into {name: {field: value}}
    changes = {}
    cur = None
    for line in open(AUDIT, encoding='utf-8'):
        m = re.match(r'^### (.+)', line)
        if m:
            cur = m.group(1).strip()
            changes.setdefault(cur, {})
            continue
        m = re.match(r'\s+CHANGE:\s+(\w+)\s+=\s+(.*)', line)
        if m and cur:
            field, val = m.group(1).strip(), m.group(2).strip()
            # last CHANGE for verified wins, but don't overwrite tube/note with verified
            if field not in changes[cur]:
                changes[cur][field] = val
            elif field == 'verified':
                changes[cur][field] = val   # always take latest verified

    # filter by letter if requested
    if a.letter:
        changes = {k: v for k, v in changes.items()
                   if k.upper().startswith(a.letter.upper())}

    rows = list(csv.DictReader(open(CSV, newline='', encoding='utf-8')))
    fields = list(rows[0].keys())
    for col in ('tube_alts',):
        if col not in fields:
            fields.append(col)

    n_changed = 0
    for r in rows:
        ch = changes.get(r['name'], {})
        if not ch:
            r.setdefault('tube_alts', '')
            continue
        for field, val in ch.items():
            old = r.get(field, '')
            if old != val:
                if a.dry or a.letter:
                    print(f"  {r['name']}: {field}  [{old!r}] → [{val[:80]!r}]")
                r[field] = val
                n_changed += 1
        r.setdefault('tube_alts', '')

    print(f'\n{n_changed} field changes across {len([k for k in changes if k])} tests')

    if a.dry:
        print('DRY RUN — nothing written')
        return

    bak = CSV + '.bak2'
    if not os.path.exists(bak):
        import shutil; shutil.copy2(CSV, bak)
    with open(CSV, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f'WROTE {CSV} ({len(rows)} rows, {len(fields)} cols)')

if __name__ == '__main__':
    main()
