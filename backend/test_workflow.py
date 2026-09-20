"""Integration tests: PDF analysis, server pricing, payments, ownership, and queue."""
import tempfile,os,io
from datetime import datetime,timezone,timedelta
with tempfile.TemporaryDirectory() as temp:
    os.environ['DATA_DIR']=temp
    import app as server
    from services.pdf_service import sample
    from services.store import Store
    from services.pricing_service import calculate,DEFAULT_PRICING
    server.app.config['TESTING']=True
    c=server.app.test_client()
    initial=c.get('/api/bootstrap').json;assert initial['stats']['completed']>0
    upload=c.post('/api/upload',data={'file':(io.BytesIO(sample()),'sample.pdf')});assert upload.status_code==201,upload.json
    d=upload.json;a=d['analysis'];assert a['total_pages']==6 and a['blank_pages']==[3] and a['color_pages']==[2,5],a
    settings={'copies':2,'paper':'A4','mode':'bw','duplex':True,'nup':1,'remove_blank':True,'range':'','orientation':'auto'}
    q=c.post('/api/pricing/calculate',json={'document_id':d['id'],'settings':settings}).json
    assert (q['pages'],q['sheets'],q['amount'],q['saved_sheets'])==(5,6,8,6),q
    invalid=c.post('/api/pricing/calculate',json={'document_id':d['id'],'settings':{**settings,'range':'9'}});assert invalid.status_code==400
    assert c.post('/api/upload',data={'file':(io.BytesIO(b'not a pdf'),'bad.pdf')}).status_code==400
    foreign=server.app.test_client();assert foreign.get('/api/documents/'+d['id']+'/file').status_code==404
    j=c.post('/api/orders/create',json={'document_id':d['id'],'settings':settings,'amount':.01}).json
    assert j['amount']==8 and j['payment_status']=='Pending'
    assert not any(x['id']==j['id'] for x in c.get('/api/queue').json)
    p=c.post('/api/payment/create',json={'job_id':j['id']}).json
    failed=c.post('/api/payment/verify',json={'payment_id':p['id'],'result':'failed'}).json;assert failed['status']=='Payment Failed'
    p=c.post('/api/payment/create',json={'job_id':j['id']}).json
    paid=c.post('/api/payment/verify',json={'payment_id':p['id'],'result':'success'}).json;assert paid['status']=='Queued'
    repeated=c.post('/api/payment/verify',json={'payment_id':p['id'],'result':'success'}).json;assert repeated['payment_status']=='Verified'
    with c.session_transaction() as session:w=session['workspace']
    store=Store(server.config.DB_PATH);j=store.get('print_jobs',w,j['id']);j['started_at']=(datetime.now(timezone.utc)-timedelta(seconds=40)).isoformat();store.put('print_jobs',w,j);store.close()
    done=c.get('/api/jobs/'+j['id']).json;assert done['status']=='Completed',done
    new=c.get('/api/analytics/resources?source=new').json;assert new['completed']==1 and new['pages']==10 and new['saved']==6,new
    assert c.post('/api/print-agent/jobs/next',json={'printer_id':'pi-01'}).status_code==403
    print('PASS: PDF analysis, server quote, invalid uploads/ranges, private documents, payment failure/retry/idempotency, queue completion, and analytics.')
