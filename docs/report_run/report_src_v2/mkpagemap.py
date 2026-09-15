import subprocess, json, re, sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'FIRST_SCRUTINY_Restoration_Programme'
OUT=sys.argv[2] if len(sys.argv)>2 else 'pagemap.json'
TIT=sys.argv[3] if len(sys.argv)>3 else 'titles.txt'
titles=[l.strip() for l in open(TIT,encoding='utf8') if l.strip()]
n=int(subprocess.run(['pdfinfo',BASE+'.pdf'],capture_output=True,text=True).stdout.split('Pages:')[1].split()[0])

def norm(t):
    t=t.replace('’',"'").replace('ʼ',"'").replace('—','-').replace('–','-')
    return re.sub(r'[^a-z0-9]','',t.lower())

pm={}
for p in range(2,n+1):
    txt=subprocess.run(['pdftotext','-f',str(p),'-l',str(p),BASE+'.pdf','-'],
                       capture_output=True,text=True).stdout
    lines=[l.strip() for l in txt.split('\n') if l.strip()]
    if not lines: continue
    # Divider and blank pages are a couple of short centred lines with no page
    # number; they are not where a section starts.
    if len(''.join(lines)) < 120: continue
    if 'FIRST SCRUTINY' in txt:
        # A content page. Its title is in the running header, which is the first
        # few lines. Matching the whole page picks up any cross-reference in the
        # body and points the contents at the wrong page.
        zone=' '.join(lines[:4])
    else:
        # Front matter carries no banner; the page's own heading is its first line.
        zone=lines[0]
    z=norm(zone)
    for t in titles:
        if t in pm: continue
        nt=norm(t)
        if nt and nt in z: pm[t]=p
json.dump(pm, open(OUT,'w'), indent=1)
print(json.dumps(pm, indent=1))
