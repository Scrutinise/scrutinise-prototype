# Structural changes for the second draft. Ordering matters: the Part 4 merge has to
# happen before renumbering, and the framework has to be lifted out of Part 2 before
# Part 2's own sections are renumbered.
import re, os

R=lambda f: open(f,encoding='utf-8').read()
W=lambda f,t: open(f,'w',encoding='utf-8').write(t)

def split_h1(t):
    p=re.split(r'(?m)^(# .*)$',t)
    out=[]; 
    if p[0].strip(): out.append(('',p[0]))
    for i in range(1,len(p),2): out.append((p[i],p[i+1]))
    return out

# ---------------------------------------------------------------- 1. framework to Part 1
bing=R('07_bingham.md')
b=split_h1(bing)
framework=[x for x in b if x[0].startswith('# Part 2.9')]
rest    =[x for x in b if not x[0].startswith('# Part 2.9')]
fw=framework[0][1]
# It is now the opening of Part 1, not a late section of Part 2.
fw=re.sub(r'(?m)^## 2\.9 .*$','## The argument underneath all twelve: the political constitution and the legal constitution',fw)
W('02_framework.md','# Part 1 · The argument underneath all twelve\n'+fw)
W('07_bingham.md',''.join(h+'\n'+b for h,b in rest).strip()+'\n')

# ---------------------------------------------------------------- 2. four unsourced measures up to the list
reg=R('02_register.md')
i=reg.find('## Four measures attributed to David that we could not find')
unsourced=reg[i:].rstrip()+'\n' if i>=0 else ''
reg=reg[:i].rstrip()+'\n' if i>=0 else reg
reg=re.sub(r'(?m)^# Part 1 · The register$','# Part 1 · What David said, and what the law would have to do',reg)
W('02_register.md',reg)
tw=R('02a_twelve.md').rstrip()+'\n\n---\n\n'+unsourced
W('02a_twelve.md',tw)

# ---------------------------------------------------------------- 3. Part 4 merge
# 4.1 and 4.2 were the statute-book surveys of the same two measures the full
# analyses cover. Merging them is what makes "three measures worked in full" true.
p34=R('04_part3_4.md'); s=split_h1(p34)
part3   =[x for x in s if x[0].startswith('# Part 3')]
sb_hra  =[x for x in s if x[0].startswith('# Part 4.1')][0][1]
sb_eqa  =[x for x in s if x[0].startswith('# Part 4.2')][0][1]
full=R('08_part4_full.md'); f=split_h1(full)
def body(pref): return [x for x in f if x[0].startswith(pref)][0][1]
hra,eqa,cs = body('# Part 4.3'), body('# Part 4.4'), body('# Part 4.5')

def demote(t, new_h2):
    t=re.sub(r'(?m)^## .*$','## '+new_h2,t,count=1)
    return t
def sub_block(t,title):
    t=re.sub(r'(?m)^## .*$','### '+title,t,count=1)
    return re.sub(r'(?m)^### (?!'+re.escape(title)+r')','#### ',t)

out =('# Part 4.1 · The Human Rights Act\n'+demote(hra,'4.1 · The Human Rights Act 1998 and the Convention')
      +'\n'+sub_block(sb_hra,'What the statute book shows')+'\n')
out+=('# Part 4.2 · The Equality Act\n'+demote(eqa,'4.2 · The Equality Act 2010 and the public sector equality duty')
      +'\n'+sub_block(sb_eqa,'What the statute book shows')+'\n')
out+=('# Part 4.3 · The civil service\n'+demote(cs,'4.3 · The permanent, appointed civil service')+'\n')
W('08_part4.md',out); os.remove('08_part4_full.md')

# ---------------------------------------------------------------- 4. Part 3 absorbs the Great Repeal
gr=R('10_part5_9_great_repeal.md')
gr=re.sub(r'(?m)^# Part 5\.9 .*$','',gr)
gr=re.sub(r'(?m)^## 5\.9 · .*$','## 3.2 · The Great Repeal as a single instrument',gr)
W('04_part3.md',(part3[0][0]+'\n'+part3[0][1]).rstrip()+'\n\n'+gr.strip()+'\n')
os.remove('04_part3_4.md'); os.remove('10_part5_9_great_repeal.md')

# ---------------------------------------------------------------- 5. delete 2.7 and the self-referential asides
p2=R('03_part2.md')
i=p2.find('# Part 2.7 · Where our sources came from')
if i>=0: p2=p2[:i].rstrip()+'\n'
p2=re.sub(r'(?ms)^### ⚠ And a limit of our own, corrected before print.*?(?=^#{1,3} )','',p2)
W('03_part2.md',p2)

print("files now:")
for f in sorted(os.listdir('.')):
    if f.endswith('.md'): print(f"  {f:<28}{len(R(f).split()):>7,} words")
