from datetime import datetime,timezone,timedelta

def summarize(jobs,printers,days=7,start=None,end=None,source='all'):
    now=datetime.now(timezone.utc);start=start or (now-timedelta(days=days-1)).strftime('%Y-%m-%d');end=end or now.strftime('%Y-%m-%d')
    records=[j for j in jobs if start<=j['created_at'][:10]<=end and (source=='all' or bool(j.get('seed'))==(source=='sample'))]
    complete=[j for j in records if j['status']=='Completed'];total=lambda key:sum(j['quote'].get(key,0) for j in complete)
    activity=[]; cursor=datetime.fromisoformat(start)
    for _ in range(93):
        key=cursor.strftime('%Y-%m-%d')
        if key>end:break
        daily=[j for j in records if j['created_at'][:10]==key]
        activity.append({'date':key,'label':cursor.strftime('%a'),'jobs':len(daily),'pages':sum(j['quote']['pages']*j['settings']['copies'] for j in daily if j['status']=='Completed'),'sheets':sum(j['quote']['sheets'] for j in daily if j['status']=='Completed')});cursor+=timedelta(days=1)
    return {'jobs':len(records),'today_jobs':sum(j['created_at'][:10]==now.strftime('%Y-%m-%d') for j in jobs),'pages':total('bw_pages')+total('color_pages'),'bw':total('bw_pages'),'color':total('color_pages'),'saved':total('saved_sheets'),'sheets':total('sheets'),'revenue':round(sum(j['amount'] for j in complete),2),'active':sum(j['status'] in ['Queued','Sent to Controller','Printing'] for j in records),'completed':len(complete),'failed':sum(j['status']=='Failed' for j in records),'duplex':sum(j['settings']['duplex'] for j in complete),'single':sum(not j['settings']['duplex'] for j in complete),'activity':activity,'sample_jobs':sum(bool(j.get('seed')) for j in records),'new_jobs':sum(not j.get('seed') for j in records),'start':start,'end':end,'avg_wait':round(sum(max(0,(datetime.fromisoformat(j.get('started_at',j['created_at']))-datetime.fromisoformat(j['created_at'])).total_seconds()) for j in complete)/max(1,len(complete))/60,1),'utilization':[{'name':p['name'],'pages':sum(j['quote']['pages']*j['settings']['copies'] for j in complete if j['printer_id']==p['id'])} for p in printers],'peak':[{'hour':h,'jobs':sum(datetime.fromisoformat(j['created_at']).hour==h for j in records)} for h in range(8,19)]}

def insights(jobs,printers):
    s=summarize(jobs,printers); out=[]
    if s['saved']:out.append({'type':'green','title':f"{s['saved']} sheets saved this week",'text':'Compared with printing each selected page on its own sheet. Duplex and multiple pages per side make a difference.','action':'See resource usage','to':'/usage'})
    available=[p for p in printers if p['enabled']]
    if available:
        p=min(available,key=lambda p:sum(j['printer_id']==p['id'] and j['status'] in ['Queued','Printing','Sent to Controller'] for j in jobs))
        out.append({'type':'blue','title':p['name']+' is a good place to start','text':'It currently has the shortest active queue among available printers.','action':'Start a print','to':'/new'})
    if s['pages']:out.append({'type':'cyan','title':str(round(100*s['bw']/s['pages']))+'% of printed pages are monochrome','text':'Use Auto color to reserve color pricing for pages that actually need it.','action':'Analyze a document','to':'/new'})
    if s['single']:out.append({'type':'orange','title':str(s['single'])+' jobs could use duplex','text':'These completed jobs used single-sided printing. Check document requirements before switching.','action':'Explore insights','to':'/insights'})
    if s['peak'] and max(x['jobs'] for x in s['peak']):
        h=max(s['peak'],key=lambda x:x['jobs'])['hour'];out.append({'type':'blue','title':f'Busiest hour: {h:02d}:00–{h+1:02d}:00 UTC','text':'Based on the last seven days of recorded job creation times, including labeled sample records.','action':'View analytics','to':'/usage'})
    return out
