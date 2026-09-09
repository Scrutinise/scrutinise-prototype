import re,os
FILES=['08_part4.md','09_part5_rest.md','04_part3.md']
# Whole sections that are process commentary. Charlie's rule: the reader goes to the
# legislation, not to an account of how the document was produced. The critique still
# happened - it is evidence of capability - but it belongs in an appendix, not the body.
DROP=['Tested as an argument','Tested as a strategy','Read back by other models',
      'Read as a hostile clerk','Where the research changed the draft']
# Headings whose content is sound but whose wording names the machinery.
RENAME={
 'The question put to the instrument':'The question examined',
 'What the search returned':'The evidence base',
 'What it concluded was wrong, and why it persists':'What is wrong, and why it persists',
 'The approach it proposed':'The approach proposed',
 'The challenges raised against it':'Challenges to the proposal',
 'Where the evidence contradicted the draft':'Evidence that runs the other way',
}
pulled=[]
for fn in FILES:
    if not os.path.exists(fn): continue
    t=open(fn,encoding='utf-8').read()
    for d in DROP:
        pat=re.compile(r'(?ms)^(#{3,4} '+re.escape(d)+r')\s*$(.*?)(?=^#{1,4} |\Z)')
        for m in pat.finditer(t): pulled.append((fn,d,m.group(2).strip()))
        t=pat.sub('',t)
    for a,b in RENAME.items():
        t=re.sub(r'(?m)^(#{3,4}) '+re.escape(a)+r'\s*$',lambda m:f"{m.group(1)} {b}",t)
    t=re.sub(r'\n{4,}','\n\n\n',t)
    open(fn,'w',encoding='utf-8').write(t)

with open('12_appendix_b_critique.md','w',encoding='utf-8') as fh:
    fh.write("# Appendix B · The proposals under test\n\n")
    fh.write("Each measure was put through the same four tests before it was written up: "
             "whether it holds as a strategy, whether it holds as an argument, how it reads to "
             "an independent reviewer, and how it reads to a hostile one. The results are "
             "recorded here rather than in the body, where they would interrupt the analysis.\n\n")
    cur=None
    for fn,d,body in pulled:
        if not body: continue
        fh.write(f"## {d}\n\n{body}\n\n---\n\n")
print(f"sections pulled to Appendix B: {len(pulled)}  ({len(open('12_appendix_b_critique.md',encoding='utf-8').read().split()):,} words)")
for f in ['08_part4.md','09_part5_rest.md','04_part3.md','12_appendix_b_critique.md']:
    print(f"  {f:<30}{len(open(f,encoding='utf-8').read().split()):>8,} words")
