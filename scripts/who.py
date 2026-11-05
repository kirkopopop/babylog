import json,sys,os
T=sys.argv[1]; out={}
for sex,s in [('boys','m'),('girls','f')]:
    for key,fn in [('weight',f'wfa_{sex}_0_5_zscores.json'),('length',f'lhfa_{sex}_0_2_zscores.json'),('head',f'hcfa_{sex}_0_5_zscores.json')]:
        rows=json.load(open(os.path.join(T,fn)))
        r0=rows[0]; 
        ak=[k for k in r0 if k.lower() in ('month','age','months')][0]
        tab=[]
        for r in rows:
            m=float(r[ak])
            if m<=24.0001: tab.append([round(float(r['L']),5),round(float(r['M']),5),round(float(r['S']),6)])
        out[f'{s}_{key}']=tab
print(json.dumps({k:len(v) for k,v in out.items()}), json.dumps(out['m_weight'][:2]), json.dumps(out['m_weight'][8]))
json.dump(out,open(sys.argv[2],'w'))
