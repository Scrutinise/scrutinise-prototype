# Repairs the renderer's character-cap cuts.
#
# Restoration is filtered by PROVENANCE, not just by length. The build export holds
# two very different kinds of string: report content (the deepening issues, the
# retrieved evidence bodies, the kernel), and internal scaffolding carried between
# passes (passes_by_key/*/carry/*), which opens with instructions addressed to the
# model. Splicing the second kind back in would put process chat into a document
# that must not contain any - so those passages are closed off cleanly instead.
import json, re, glob, os

BUILDS='/mnt/user-data/uploads/docs/report_run/builds'
FILES=['02_register.md','03_part2.md','04_part3_4.md','08_part4_full.md',
       '09_part5_rest.md','10_part5_9_great_repeal.md']
CONTENT=('/deepening/issues[]/text','/evidence[]/body','/kernel/','/build/','/inputs_as_supplied/')
APPENDIX_OVER=1500      # Charlie's threshold: longer than this goes to the appendix

def norm(s):
    s=s.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"')
    s=s.replace('–','-').replace('—','-').replace('\xa0',' ')
    return re.sub(r'\s+',' ',s)

pool=[]
for p in sorted(glob.glob(os.path.join(BUILDS,'M-*.json'))):
    d=json.load(open(p,encoding='utf-8'))
    def walk(o,path=''):
        if isinstance(o,str):
            if len(o)>120: pool.append((o,path))
        elif isinstance(o,dict):
            for k,v in o.items(): walk(v,path+'/'+k)
        elif isinstance(o,list):
            for v in o: walk(v,path+'[]')
    walk(d)
seen=set(); npool=[]
for s,pa in pool:
    if s in seen: continue
    seen.add(s); npool.append((norm(s),s,pa))

def is_content(path): return any(c in path for c in CONTENT)

def close_off(before):
    """End a scaffolding-sourced passage at its last complete sentence."""
    m=list(re.finditer(r'[.!?][)"\'’”]?\s', before))
    return before[:m[-1].end()].rstrip() if m else before.rstrip().rstrip(',;:') + '.'

appendix=[]; rows=[]
for fn in FILES:
    if not os.path.exists(fn): continue
    t=open(fn,encoding='utf-8').read(); edits=[]
    rest=moved=closed=miss=quote=0
    for m in re.finditer('…',t):
        after=t[m.end():m.end()+30]
        if not (after=='' or after.startswith('\n') or re.match(r'^\s*$',after)):
            quote+=1; continue
        ls=t.rfind('\n',0,m.start())+1
        before=t[ls:m.start()]
        anchor=norm(before[-60:]).strip()
        if len(anchor)<25: miss+=1; continue
        hit=None
        for ns,o,pa in npool:
            i=ns.find(anchor)
            if i>=0 and ns[i+len(anchor):].strip(): hit=(ns[i+len(anchor):],pa); break
        if hit is None:
            edits.append((ls,m.end(),close_off(before))); closed+=1; continue
        tail,pa=hit
        if not is_content(pa):
            edits.append((ls,m.end(),close_off(before))); closed+=1; continue
        if len(before.split())+len(tail.split())<=APPENDIX_OVER:
            edits.append((m.start(),m.end(),' '+tail.strip())); rest+=1
        else:
            n=len(appendix)+1
            sec=''
            for h in re.finditer(r'(?m)^#{2,4} (.+)$',t[:m.start()]): sec=h.group(1)
            part=''
            for h in re.finditer(r'(?m)^# (.+)$',t[:m.start()]): part=h.group(1)
            appendix.append((n,part,sec,norm(before)+' '+tail.strip()))
            edits.append((m.start(),m.end(),
                          ' '+' '.join(tail.split()[:100])+f" **[Continued at Appendix A, item {n}.]**"))
            moved+=1
    for s,e,rep in reversed(edits): t=t[:s]+rep+t[e:]
    open(fn,'w',encoding='utf-8').write(t)
    rows.append((fn,rest,moved,closed,miss,quote))

if appendix:
    with open('11_appendix_a.md','w',encoding='utf-8') as fh:
        fh.write("# Appendix A · Long passages carried in full\n\n")
        fh.write("Material retrieved and read during the analysis, reproduced in full here where its "
                 "length would otherwise interrupt the argument.\n\n")
        for n,part,sec,text in appendix:
            fh.write(f"## A.{n} · {sec or part}\n\n*From {part}.*\n\n{text.strip()}\n\n---\n\n")

print(f"{'file':<30}{'restored':>9}{'appendix':>9}{'closed':>8}{'unmatched':>11}{'quotes':>8}")
T=[0]*5
for r in rows:
    print(f"{r[0]:<30}{r[1]:>9}{r[2]:>9}{r[3]:>8}{r[4]:>11}{r[5]:>8}")
    T=[T[i]+r[i+1] for i in range(5)]
print(f"{'TOTAL':<30}{T[0]:>9}{T[1]:>9}{T[2]:>8}{T[3]:>11}{T[4]:>8}")
print(f"\nAppendix A: {len(appendix)} items, {sum(len(a[3].split()) for a in appendix):,} words")
