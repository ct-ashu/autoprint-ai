from datetime import datetime,timezone

def now():return datetime.now(timezone.utc).isoformat()
def transition(job,status):
    job['status']=status;job['updated_at']=now();job.setdefault('timeline',[]).append({'status':status,'at':job['updated_at']});return job

def tick(store,workspace,simulation=True):
    if not simulation:return
    jobs=store.all('print_jobs',workspace)
    for p in store.all('printers',workspace):
        if not p['enabled']:continue
        active=sorted([j for j in jobs if j['printer_id']==p['id'] and j['payment_status']=='Verified' and j['status'] in ['Queued','Sent to Controller','Printing']],key=lambda j:j['created_at'])
        if not active:continue
        job=active[0]
        if not job.get('started_at'):
            job['started_at']=now();transition(job,'Sent to Controller')
        elapsed=(datetime.now(timezone.utc)-datetime.fromisoformat(job['started_at'])).total_seconds()
        if elapsed>=28:transition(job,'Completed')
        elif elapsed>=6 and job['status']!='Printing':transition(job,'Printing')
        store.put('print_jobs',workspace,job)
