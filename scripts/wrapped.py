import json,glob,collections,re,sys,os
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
# Usage: python wrapped.py <folder with unzipped export> [IANA timezone]
# Reads only conversations, projects, design_chats, frames (count only) and claude_code_cloud. Never reads light_metadata.
base=sys.argv[1]; TZ=ZoneInfo(sys.argv[2] if len(sys.argv)>2 else 'UTC'); YEAR=2026
def ts(s): return datetime.fromisoformat(s.replace('Z','+00:00')).astimezone(TZ)
conv=json.load(open(glob.glob(base+'/*conversations*/conversations.json')[0]))
conv=[c for c in conv if ts(c['created_at']).year==YEAR]
months=collections.Counter(); hours=collections.Counter(); wd=collections.Counter(); days=set()
hmsg=amsg=0; hchars=achars=tchars=0; thinking=0; tools=collections.Counter(); lens=[]
langs=collections.Counter(); words=collections.Counter(); attach=0
SW={'pt':{'não','que','para','uma','como','está','você','tens','queres','obrigado','também','isso'},
    'fr':{'je','est','les','pour','une','pas','avec','vous','mon','dans','merci'},
    'es':{'que','para','una','pero','estoy','tengo','muy','gracias','también','hola'},
    'en':{'the','and','you','for','with','this','what','how','can','is','my'}}
for c in conv:
    n=0; first=None
    for m in c['chat_messages']:
        t=ts(m['created_at']); n+=1
        attach+=len(m.get('files') or [])+len(m.get('attachments') or [])
        if m['sender']=='human':
            hmsg+=1; months[t.month]+=1; hours[t.hour]+=1; wd[t.strftime('%a')]+=1; days.add(t.date())
            txt=m.get('text') or ''; hchars+=len(txt); first=first or txt
            if len(txt)<300:
                for w in re.findall(r"[a-zà-ú']+",txt.lower()): words[w]+=1
        else: amsg+=1
        for b in m['content']:
            if b['type']=='text' and m['sender']!='human': achars+=len(b.get('text') or '')
            elif b['type']=='thinking': thinking+=1; tchars+=len(b.get('thinking') or '')
            elif b['type']=='tool_use': tools[b.get('name')]+=1
    lens.append((n,c['name']))
    if first:
        ws=set(re.findall(r"[a-zà-ú]+",first.lower()))
        sc={k:len(ws&v) for k,v in SW.items()}; 
        if max(sc.values())>0: langs[max(sc,key=sc.get)]+=1
# streak
d=sorted(days); best=cur=1
for a,b in zip(d,d[1:]): cur=cur+1 if (b-a).days==1 else 1; best=max(best,cur)
cat=lambda names: sum(tools[n] for n in tools if any(k in (n or '').lower() for k in names))
cowork_tools={'Bash','Write','Edit','Read','SendUserFile','Artifact','TaskCreate'}
cowork_chats=sum(1 for c in conv if any(b['type']=='tool_use' and b.get('name') in cowork_tools for m in c['chat_messages'] for b in m['content']))
out={
 'chats':len(conv),'your_messages':hmsg,'claude_messages':amsg,
 'active_days':len(days),'longest_streak_days':best,
 'est_tokens_visible':round((hchars+achars+tchars)/4),'your_words':round(hchars/5.5),'claude_words':round(achars/5.5),
 'thinking_blocks':thinking,'tool_calls':sum(tools.values()),
 'web_searches':cat(['search']) - tools.get('conversation_search',0),'code_runs':cat(['bash']),'files_created':cat(['create_file','write','present_files','senduserfile']),
 'memory_lookups':cat(['memory','conversation_search','recent_chats']),
 'agent_style_chats':cowork_chats,'files_uploaded':attach,
 'by_month':{datetime(2026,k,1).strftime('%b'):v for k,v in sorted(months.items())},
 'by_hour':dict(sorted(hours.items())),'by_weekday':dict(wd),
 'languages_first_msg':dict(langs),
 'longest_chat':max(lens),
 'top_tools':tools.most_common(8),
}
# other surfaces
dz=[json.load(open(f)) for f in glob.glob(base+'/*design_chats*/design_chats/*.json')]
out['design_chats']=len(dz); out['design_chats_with_msgs']=sum(1 for x in dz if x['messages']); out['design_projects']=len({x['project']['name'] for x in dz if x.get('project')})
pj=[json.load(open(f)) for f in glob.glob(base+'/*projects*/projects/*.json')]
out['projects_total']=len(pj); out['projects_created_2026']=sum(1 for p in pj if ts(p['created_at']).year==YEAR)
fa=glob.glob(base+'/*frames*/artifacts/*/artifact.json'); out['artifacts']=len(fa)
rr=glob.glob(base+'/*claude_code_cloud*/claude_code_cloud/routine_runs.json')
if rr: out['scheduled_runs']=len(json.load(open(rr[0]))['claude_code_cloud'])
stop={'que','de','a','o','e','the','to','and','i','é','do','da','em','um','para','of','in','is','it','me','com','os','no','na','se','what','for','this','you','my','on','with','be','as','that','la','le','les','des','et','en','un','une','du','eu','não','mas','as','uma','te','can','are','an','or','if','so','at','by','have','how','also','all','just','we','from','but','was','not','there','it\'s','ao','há','mais','por','sobre','pelo','pela','ser','tem','well','will','any','one','them','your','which','into','nos','esta','este','isso','como','meu','minha','are','would','could','should','about','like','want','need','make','use','using'}
out['your_top_words']=[w for w,_ in words.most_common(300) if w not in stop and len(w)>3][:15]
# --- story-card extras ---
day=collections.Counter(); daytopics=collections.defaultdict(set); kids=collections.Counter(); thanks=em=0; oneshot=0
for c in conv:
    hm=0
    for m in c['chat_messages']:
        kids[(c['uuid'],m.get('parent_message_uuid'),m['sender'])]+=1
        if m['sender']=='human':
            hm+=1; d=ts(m['created_at']).date(); day[d]+=1; daytopics[d].add(c.get('name') or '')
            thanks+=len(re.findall(r"\b(thanks|thank you|obrigad[oa]|merci|gracias|danke)\b",(m.get('text') or '').lower()))
        else:
            em+=sum((b.get('text') or '').count('\u2014') for b in m['content'] if b['type']=='text')
    oneshot+= hm==1
if day:
    d,n=day.most_common(1)[0]
    out['chattiest_day']={'date':d.isoformat(),'messages':n,'topics':len(daytopics[d])}
out['avg_messages_per_active_day']=round(hmsg/max(1,len(days)),1)
out['retries']=sum(v-1 for v in kids.values() if v>1)   # edits + regenerations (sibling branches)
out['thanks']=thanks; out['em_dashes_from_claude']=em; out['one_shot_chats']=oneshot
night=sum(v for h,v in hours.items() if h>=22 or h<5)
out['night_share']=round(night/max(1,hmsg),3)
out['weekend_share']=round((wd.get('Sat',0)+wd.get('Sun',0))/max(1,hmsg),3)
# AI Club v1: highest score wins. Thresholds are placeholders, recalibrate with Wall data.
n=max(1,len(conv))
scores={'Researchers':out['web_searches']/n/2.0,'Builders':(out['files_created']+out.get('artifacts',0))/n/0.7,
        'Coders':out['code_runs']/n/0.8,'Night Shift':out['night_share']/0.15,
        'Polyglots':len([k for k,v in langs.items() if v>=3])/3,'Talkers':(hmsg/n)/6}
out['club']=max(scores,key=scores.get); out['club_scores']={k:round(v,2) for k,v in scores.items()}
out['chat_titles']=[c['name'] for c in conv if c.get('name')]
print(json.dumps(out,ensure_ascii=False,indent=1))
