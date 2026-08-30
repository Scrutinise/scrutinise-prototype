"""Extract text from the Starkey .docx transcripts (CCW-B8 step 2/3).

A .docx is a zip with word/document.xml inside; paragraph text is the <w:t>
runs of each <w:p>. That is all this needs, so it uses only the standard
library — no new dependency for a one-shot extraction.

Each document holds its transcript TWICE: a prose section with (M:SS) inline
markers, then an SRT block (index / "HH:MM:SS,mmm --> HH:MM:SS,mmm" / text).
The SRT block is the one worth keeping: it carries a start AND an end time per
cue, which the prose markers do not.

Writes, per document, into the work directory:
  <stem>.prose.txt   the prose section, one paragraph per line
  <stem>.srt         the SRT section verbatim (absent if the document has none)
  <stem>.meta.json   engine, source URLs, paragraph counts

Nothing here is loaded or deleted; disposition is docx-disposition.ts.
"""
import json
import os
import re
import sys
import zipfile

SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'report_run', 'sources', 'youtube')
OUT = os.path.join(SRC, '_docx_extract')

# The tool names seen in these documents' own footers. 'descript' is
# deliberately absent: it is a substring of "description" in body text, not the
# Descript product, and matching it would mislabel documents.
ENGINES = ['turboscribe', 'summarize.ing', 'summarize', 'tactiq.io', 'tactiq', 'otter.ai', 'rev.com', 'sonix', 'happyscribe']

ENTITIES = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'"}
TIMING = re.compile(r'^\s*(?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->|^\s*\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->')


def unescape(s):
    for k, v in ENTITIES.items():
        s = s.replace(k, v)
    return re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), s)


def paragraphs(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    out = []
    for p in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S):
        # <w:br/> and <w:tab/> are line structure inside a paragraph.
        p = re.sub(r'<w:(?:br|tab)\s*/>', '\n', p)
        t = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, re.S))
        out.append(unescape(t).replace('\xa0', ' '))
    return out


def split_sections(paras):
    """Index of the first paragraph that is an SRT/VTT timing line, or None."""
    for i, t in enumerate(paras):
        for line in t.split('\n'):
            if TIMING.match(line):
                return i
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    report = []
    for name in sorted(os.listdir(SRC)):
        if not name.lower().endswith('.docx'):
            continue
        path = os.path.join(SRC, name)
        stem = os.path.splitext(name)[0]
        paras = paragraphs(path)
        joined = '\n'.join(paras)
        low = joined.lower()

        engines = sorted({e for e in ENGINES if e in low})
        urls = re.findall(r'(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})', joined)

        cut = split_sections(paras)
        prose = paras[:cut] if cut is not None else paras
        srt_lines = []
        if cut is not None:
            # From the first timing line to the end, preserving blank lines so a
            # standard SRT/VTT parser sees real cue boundaries.
            for t in paras[cut:]:
                srt_lines.extend(t.split('\n'))
            # The index line for cue 1 is often swallowed into the preceding
            # prose paragraph; a leading timing line parses fine without it.

        with open(os.path.join(OUT, stem + '.prose.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(prose))
        n_cues = 0
        if srt_lines:
            with open(os.path.join(OUT, stem + '.srt'), 'w', encoding='utf-8') as f:
                f.write('\n'.join(srt_lines))
            n_cues = sum(1 for l in srt_lines if TIMING.match(l))

        report.append({
            'file': name, 'stem': stem, 'paragraphs': len(paras),
            'engines_found': engines, 'video_ids_in_document': urls,
            'srt_section': cut is not None, 'srt_timing_lines': n_cues,
            'prose_paragraphs': len(prose),
        })

    with open(os.path.join(OUT, '_extract.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    for r in report:
        print('%-40s paras=%-5d engines=%-18s ids=%-28s srt_cues=%d'
              % (r['stem'][:40], r['paragraphs'], ','.join(r['engines_found']) or '-',
                 ','.join(dict.fromkeys(r['video_ids_in_document'])) or '-', r['srt_timing_lines']))


if __name__ == '__main__':
    sys.exit(main())
