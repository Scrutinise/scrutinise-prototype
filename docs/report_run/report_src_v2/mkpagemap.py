import subprocess, json, re, sys
import os
BASE=sys.argv[1] if len(sys.argv)>1 else 'FIRST_SCRUTINY_Restoration_Programme'
OUT=sys.argv[2] if len(sys.argv)>2 else 'pagemap.json'
TIT=sys.argv[3] if len(sys.argv)>3 else 'titles.txt'
titles = [l.strip() for l in open(TIT,encoding='utf8') if l.strip()]
n = int(subprocess.run(['pdfinfo',BASE+'.pdf'],capture_output=True,text=True).stdout.split('Pages:')[1].split()[0])
pm={}
def norm(t): return re.sub(r'\s+',' ',t.replace(chr(8217),"'").replace(chr(700),"'").replace(chr(8212),'-').replace("'",'').replace(chr(8211),'-')).strip().lower()
for p in range(3,n+1):
    txt = subprocess.run(['pdftotext','-f',str(p),'-l',str(p),BASE+'.pdf','-'],capture_output=True,text=True).stdout
    nt = norm(txt)
    for t in titles:
        if t in pm: continue
        if norm(t) in nt: pm[t]=p; continue
        sq=lambda x: re.sub(r'[^a-z0-9]','',x.lower())
        if sq(t) and sq(t) in sq(txt): pm[t]=p
json.dump(pm, open(OUT,'w'), indent=1)
print(json.dumps(pm, indent=1))
