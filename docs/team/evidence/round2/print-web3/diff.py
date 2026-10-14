# Compares before/ and after/ computed-style dumps. The inline icon sprite (svg#frappe-symbols) is emitted in a
# different symbol order on every request by core, so its subtree is excluded; everything else is compared 1:1.
import json,glob,os
INNER={'SYMBOL','PATH','G','CIRCLE','RECT','LINE','DEFS','POLYLINE','POLYGON','ELLIPSE','CLIPPATH','MASK','TITLE','LINEARGRADIENT','STOP','DEFS','SVG_SPRITE'}
def split(d):
    keys=list(d); out={}; sprite=0; inside=False
    for k in keys:
        tag=k.split(':')[1].split('#')[0].upper()
        if 'svg#frappe-symbols' in k: inside=True; sprite+=1; continue
        if inside and tag in INNER: sprite+=1; continue
        inside=False; out[k.split(':',1)[1]+'@'+str(len(out))]=d[k]
    return out,sprite
tot=0
for f in sorted(glob.glob('before/*.json')):
    n=os.path.basename(f); a,sa=split(json.load(open(f))); b,sb=split(json.load(open('after/'+n)))
    d=[]
    if list(a)!=list(b): d.append(('KEYS',len(a),len(b)))
    for k in a:
        if k in b and a[k]!=b[k]:
            for p in a[k]:
                if a[k][p]!=b[k][p]: d.append((k,p,a[k][p],b[k][p]))
    intended=[x for x in d if x[0]!='KEYS' and x[0].startswith('A#.text-muted') and 'color' in x[1]]
    other=[x for x in d if x not in intended]
    print(f"{n:24} compared {len(a):5} elements (sprite {sa} skipped)  differences {len(d):3}  intended text-muted {len(intended):3}  other {len(other)}")
    for x in other[:10]: print('    OTHER',x)
    tot+=len(other)
print('TOTAL unintended differences',tot)
