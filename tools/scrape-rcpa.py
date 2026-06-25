#!/usr/bin/env python3
"""Crawl the RCPA Manual page for each test in data/tests.csv and capture the
verbatim "Keywords:" and "Specimen:" fields into two columns:
  rcpa_keywords, rcpa_specimen

RCPA blocks plain bots (403), so pages are fetched with curl + a browser
User-Agent. Pages are cached under tools/rcpa-cache/ keyed by URL slug, so
re-runs do not refetch. The CSV is rewritten in full (DictReader -> DictWriter)
to avoid the partial-write truncation that has bitten this file before.

Usage:
  python tools/scrape-rcpa.py --letter A          # dry-run, validate parsing for A*
  python tools/scrape-rcpa.py --limit 10          # dry-run first 10 rows with a URL
  python tools/scrape-rcpa.py --all --write       # full crawl + write columns back
"""
import csv, sys, os, re, html, subprocess, time, argparse, hashlib

try:                                    # Windows console is cp1252; specimen text has Greek/micro signs
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, 'data', 'tests.csv')
CACHE = os.path.join(ROOT, 'tools', 'rcpa-cache')
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

def slug(url):
    return hashlib.sha1(url.encode()).hexdigest()[:16] + '.html'

def fetch(url):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, slug(url))
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return open(path, encoding='utf-8', errors='replace').read()
    r = subprocess.run(['curl', '-s', '-L', '-A', UA, '-H', 'Accept: text/html',
                        '--max-time', '30', url],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    body = r.stdout or ''
    if len(body) > 1000:
        open(path, 'w', encoding='utf-8').write(body)
    time.sleep(0.3)
    return body

def clean(frag):
    """HTML fragment -> plain text: paragraphs joined by a space, entities decoded."""
    frag = re.sub(r'(?is)<\s*br\s*/?>', ' ', frag)
    frag = re.sub(r'(?is)</p>', ' ', frag)
    frag = re.sub(r'(?is)<[^>]+>', '', frag)        # drop remaining tags
    frag = html.unescape(frag)
    return re.sub(r'\s+', ' ', frag).strip()

def parse(htmltext):
    """Return (keywords, specimen) verbatim text, or '' if absent."""
    kw = ''
    m = re.search(r'(?is)Keywords:\s*(.*?)</(?:div|p)>', htmltext)
    if m:
        kw = clean(m.group(1))
    sp = ''
    # the Specimen row: <tr><th>Specimen:</th><td> ... </td></tr>
    m = re.search(r'(?is)<th[^>]*>\s*Specimen:\s*</th>\s*<td[^>]*>(.*?)</td>', htmltext)
    if m:
        sp = clean(m.group(1))
    return kw, sp

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--letter')
    ap.add_argument('--limit', type=int)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()

    with open(CSV, newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    fields = list(rows[0].keys())
    for c in ('rcpa_keywords', 'rcpa_specimen'):
        if c not in fields:
            fields.append(c)

    sel = rows
    if a.letter:
        sel = [r for r in rows if r['name'].upper().startswith(a.letter.upper())]
    n_done = n_kw = n_sp = n_nourl = 0
    for r in sel:
        url = r.get('rcpa', '').strip()
        if not url:
            n_nourl += 1
            continue
        kw, sp = parse(fetch(url))
        r['rcpa_keywords'] = kw
        r['rcpa_specimen'] = sp
        n_done += 1
        if kw: n_kw += 1
        if sp: n_sp += 1
        print(f"  {r['name'][:40]:40s} | kw={kw[:25]:25s} | sp={sp[:60]}")
        if a.limit and n_done >= a.limit:
            break

    print(f"\nProcessed {n_done} pages | keywords found {n_kw} | specimen found {n_sp} | no-url {n_nourl}")

    if a.write:
        for r in rows:                      # ensure every row has the new keys
            r.setdefault('rcpa_keywords', '')
            r.setdefault('rcpa_specimen', '')
        bak = CSV + '.bak'
        os.replace(CSV, bak) if not os.path.exists(bak) else None
        with open(CSV, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        print(f"WROTE {CSV} ({len(rows)} rows, {len(fields)} cols). Backup at {bak}")

if __name__ == '__main__':
    main()
