"""Split David Starkey.docx into its five sessions, and prove the split.

TWO INDEPENDENT SIGNALS, because one would be a guess:
  (a) the clock resetting — a timestamp lower than the one before it
  (b) the session label appearing as its own paragraph

If they disagree, that is reported rather than silently reconciled.

⚠ The document uses TWO timestamp notations and a first pass that knew only one
found 1 reset instead of 4. It also carries literal escaped XML (`<w:rPr>...`)
as visible text, which is structure, not speech, and is dropped.
"""
import json, os, re, zipfile

_HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(_HERE, '..', '..', 'docs', 'report_run', 'sources', 'David Starkey.docx')
# ⚠ Writes beside the script, NOT into docs/report_run — the split carries the
# full session text, which is transcript content and stays out of the repo.
# scripts/starkey/b11-sessions.json is git-ignored for that reason.
OUT = os.path.join(_HERE, 'b11-sessions.json')
ENT = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'"}

LABELS = ['Disraeli conference', 'With Stephen Barratt', 'With Danny Kruger',
          'Brexit Started a revolution']


def unescape(s):
    for k, v in ENT.items():
        s = s.replace(k, v)
    return re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), s)


def paragraphs(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    out = []
    for p in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S):
        p = re.sub(r'<w:(?:br|tab)\s*/>', '\n', p)
        t = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, re.S))
        out.append(unescape(t).replace('\xa0', ' ').strip())
    return out


# Both notations. Returns seconds, or None if the paragraph is not a timestamp.
COLON = re.compile(r'^(\d{1,2}):(\d{2})(?::(\d{2}))?$')
PROSE = re.compile(r'^(?:(\d+)\s*hours?,?\s*)?(?:(\d+)\s*minutes?,?\s*)?(?:(\d+)\s*seconds?)?$', re.I)


def as_time(p):
    m = COLON.match(p)
    if m:
        a, b, c = m.groups()
        return int(a) * 3600 + int(b) * 60 + int(c) if c else int(a) * 60 + int(b)
    if not re.search(r'\d', p):
        return None
    m = PROSE.match(p)
    if m and any(m.groups()):
        h, mi, s = (int(x) if x else 0 for x in m.groups())
        return h * 3600 + mi * 60 + s
    return None


def is_xml_noise(p):
    return p.startswith('<w:') or ('<w:rPr>' in p) or ('w:ascii=' in p)


paras = paragraphs(PATH)
kept = [(i, p) for i, p in enumerate(paras) if p and not is_xml_noise(p)]
print('paragraphs %d, after dropping XML noise %d' % (len(paras), len(kept)))

times = [(i, p, as_time(p)) for i, p in kept if as_time(p) is not None]
print('timestamp paragraphs: %d  (first %s, last %s)' % (len(times), times[0][1], times[-1][1]))

print('\n--- signal (a): clock resets ---')
resets = []
prev_t, prev_i = None, None
for i, p, t in times:
    if prev_t is not None and t < prev_t - 30:      # -30s guard against jitter
        resets.append((i, p, prev_t))
        print('  para %5d  %-22s after %5ds (%d:%02d)' % (i, p, prev_t, prev_t // 60, prev_t % 60))
    prev_t = t
print('  resets found: %d  (4 expected for 5 sessions)' % len(resets))

print('\n--- signal (b): label paragraphs ---')
label_at = {}
for i, p in kept:
    for lab in LABELS:
        if p.strip().lower() == lab.lower() or p.strip().lower().startswith(lab.lower()):
            label_at.setdefault(lab, i)
            print('  para %5d  %s' % (i, p[:70]))

print('\n--- do the two signals agree? ---')
reset_idx = [r[0] for r in resets]
for lab, i in sorted(label_at.items(), key=lambda kv: kv[1]):
    near = [r for r in reset_idx if abs(r - i) <= 12]
    print('  %-28s label@%-6d nearest reset %s  %s' % (lab, i, near or 'NONE', 'AGREE' if near else '⚠ DISAGREE'))

# Boundaries = union of both signals, earliest paragraph of each join.
bounds = sorted(set([min(label_at[l], *[r for r in reset_idx if abs(r - label_at[l]) <= 12] or [label_at[l]]) for l in label_at]))
starts = [0] + bounds
print('\nsession start paragraphs:', starts)

sessions = []
for n, s in enumerate(starts):
    e = starts[n + 1] if n + 1 < len(starts) else len(paras)
    body = [p for i, p in kept if s <= i < e and as_time(p) is None]
    text = ' '.join(body)
    label = next((l for l, i in label_at.items() if i == s), '(unlabelled opening)')
    last = max([t for i, _, t in times if s <= i < e] or [0])
    sessions.append({'n': n + 1, 'label': label, 'start_para': s, 'end_para': e,
                     'words': len(text.split()), 'last_timestamp_s': last, 'text': text})
    print('  %d  %-28s paras %5d-%-5d  %6d words  runs to %d:%02d'
          % (n + 1, label[:28], s, e, len(text.split()), last // 60, last % 60))

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(sessions, f)
print('\nwrote', OUT)
