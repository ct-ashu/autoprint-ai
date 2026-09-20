from datetime import datetime,timezone,timedelta
from .pricing_service import DEFAULT_PRICING,calculate

def seed(store,w):
    if store.get('users',w,'profile'):return
    store.put('users',w,{'id':'profile','name':'Campus member','email':'','notify':True,'default_duplex':True,'workspace':w})
    store.put('pricing',w,{'id':'rates',**DEFAULT_PRICING})
    for i,(name,model,loc,connection) in enumerate([('Printer 01','HP LaserJet Pro','Library · Ground floor','USB'),('Printer 02','Canon imageCLASS','Academic block · Room 102','Wi-Fi'),('Printer 03','Epson EcoTank','Student centre','USB')],1):
        store.put('printers',w,{'id':f'pi-{i:02}','name':name,'model':model,'location':loc,'connection':connection,'enabled':True,'color':i!=1,'a3':i==3,'paper_level':None,'simulated':True})
    now=datetime.now(timezone.utc)
    names=['Assignment.pdf','Lab_Record.pdf','Project_Report.pdf','Lecture_Notes.pdf','Circuit_Diagrams.pdf','Research_Paper.pdf','Semester_Syllabus.pdf']
    for day in range(6,-1,-1):
        for n in range(5+(6-day)%4):
            serial=(6-day)*9+n;total=[12,24,8,32,16,40,6][n%7]
            a={'total_pages':total,'blank_pages':[],'color_pages':list(range(1,total+1)) if n%4==0 else []}
            settings={'copies':1,'paper':'A4','duplex':n%3!=0,'mode':'color' if n%4==0 else 'bw','nup':1,'range':'','remove_blank':False,'orientation':'auto'}
            q=calculate(a,settings,DEFAULT_PRICING);dt=(now-timedelta(days=day)).replace(hour=8+n,minute=12+serial%39,second=0,microsecond=0)
            if dt>now:dt=now-timedelta(minutes=10+(8-n)*7)
            at=dt.isoformat();id=f'AP-{now.year}-{1000+serial}'
            store.put('print_jobs',w,{'id':id,'document_id':None,'document_name':names[n%7],'printer_id':f'pi-{2 if n%4==0 else n%3+1:02}','settings':q['settings'],'quote':q,'amount':q['amount'],'status':'Completed','payment_status':'Verified','payment_mode':'test','created_at':at,'updated_at':at,'started_at':(dt+timedelta(seconds=80+serial%100)).isoformat(),'seed':True,'timeline':[{'status':'Completed','at':at}]})
