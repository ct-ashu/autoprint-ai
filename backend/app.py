"""AutoPrint AI REST API. Run: python app.py (127.0.0.1:5000)."""
import io,os,secrets,hmac,time,threading
from collections import defaultdict,deque
from datetime import datetime
from pathlib import Path
from flask import Flask,request,jsonify,session,g,send_file,send_from_directory
from werkzeug.exceptions import HTTPException,BadRequest,NotFound,Forbidden,TooManyRequests,ServiceUnavailable
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename
import config
from services.store import Store
from services.pdf_service import analyze,prepare,sample
from services.pricing_service import calculate,DEFAULT_PRICING
from services.analytics_service import summarize,insights
from services.queue_service import tick,transition,now
from services.seed_service import seed
from services.payment_service import create as create_payment,verify as verify_payment
app=Flask(__name__);app.secret_key=config.SECRET_KEY
app.config.update(MAX_CONTENT_LENGTH=10*1024*1024,SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE='Strict',SESSION_COOKIE_SECURE=config.COOKIE_SECURE)
# Render terminates HTTPS at its proxy. Trust one forwarded scheme, not a client-supplied host.
if config.PRODUCTION:
    app.wsgi_app=ProxyFix(app.wsgi_app,x_for=0,x_proto=1,x_host=0,x_port=0,x_prefix=0)
limits=defaultdict(deque); mutation_lock=threading.RLock()
login_attempts=deque();login_lock=threading.Lock()

@app.before_request
def before():
    if not request.path.startswith('/api/'):return
    if request.method not in ['GET','HEAD','OPTIONS'] and request.headers.get('Origin'):
        origin=request.headers['Origin'];allowed={request.host_url.rstrip('/')}
        if not config.PRODUCTION:
            allowed.update({'http://localhost:4173','http://127.0.0.1:4173','http://localhost:5173','http://127.0.0.1:5173','http://terminal.local:4173'})
        if origin not in allowed:raise Forbidden('Request origin is not allowed.')
    if request.path=='/api/admin/login' and request.method=='POST':
        # One admin account in this demo; cookie resets must not bypass the login limit.
        with login_lock:
            t=time.monotonic()
            while login_attempts and login_attempts[0]<t-60:login_attempts.popleft()
            if len(login_attempts)>=10:raise TooManyRequests('Too many login attempts. Please wait one minute.')
            login_attempts.append(t)
    sid=session.get('workspace')
    if not sid:sid=secrets.token_hex(24);session['workspace']=sid
    if request.path.startswith('/api/print-agent/'):
        token=request.headers.get('Authorization','').removeprefix('Bearer ')
        if not config.AGENT_TOKEN or not hmac.compare_digest(token,config.AGENT_TOKEN):raise Forbidden('Invalid print-agent token.')
        sid=os.getenv('PRINT_WORKSPACE','')
        if not sid:raise BadRequest('Set PRINT_WORKSPACE for this controller.')
    g.workspace=sid;g.store=Store(config.DB_PATH)
    if request.method!='GET':
        q=limits[sid];t=time.time()
        while q and q[0]<t-60:q.popleft()
        if len(q)>=60:return jsonify(error='Too many requests. Please try again in a minute.'),429
        q.append(t)
        mutation_lock.acquire();g.locked=True
    seed(g.store,sid)
    with mutation_lock:tick(g.store,sid,config.SIMULATION)

@app.teardown_request
def teardown(error):
    if getattr(g,'store',None):g.store.close()
    if getattr(g,'locked',False):mutation_lock.release()

@app.errorhandler(Exception)
def error(e):
    if isinstance(e,HTTPException):return jsonify(error=e.description),e.code
    app.logger.exception('API error');return jsonify(error='Something went wrong. Please try again.'),500

@app.after_request
def response_headers(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Frame-Options']='SAMEORIGIN'
    response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    return response

@app.get('/healthz')
def health():
    # Render probes this route without creating sessions or sample database rows.
    if not (config.FRONTEND_DIST/'index.html').is_file():
        return jsonify(status='unavailable',error='Frontend build is missing.'),503
    return jsonify(status='ok')

@app.get('/')
@app.get('/<path:path>')
def frontend(path=''):
    # Serve only the compiled public directory. API misses must remain JSON 404s.
    if path=='api' or path.startswith('api/') or any(part.startswith('.') for part in path.split('/')):
        raise NotFound()
    public=config.FRONTEND_DIST.resolve()
    candidate=(public/path).resolve()
    if not candidate.is_relative_to(public):raise NotFound()
    if candidate.is_file():
        return send_from_directory(public,path,max_age=31536000 if path.startswith('assets/') else 0)
    if path.startswith(('assets/','pdf-assets/')):raise NotFound()
    if not (public/'index.html').is_file():
        raise ServiceUnavailable('Build the frontend with npm --prefix frontend run build, or use the frontend development server.')
    return send_from_directory(public,'index.html',max_age=0)

def get(table,id):
    record=g.store.get(table,g.workspace,id)
    if not record:raise NotFound('This record was not found in your workspace.')
    return record

def put(table,row):return g.store.put(table,g.workspace,row)
def allrows(table):return g.store.all(table,g.workspace)
def body():return request.get_json(silent=True) or {}
def is_admin():
    return bool(session.get('admin_authenticated') and session.get('admin_user')==config.ADMIN_USERNAME and session.get('admin_expires',0)>time.time())

def admin():
    if is_admin():
        return

    token = request.headers.get("X-Admin-Token", "")

    if (
        config.ADMIN_TOKEN
        and token
        and hmac.compare_digest(token, config.ADMIN_TOKEN)
    ):
        return

    raise Forbidden("Administrator login is required.")
def list_jobs():return sorted(allrows('print_jobs'),key=lambda j:j['created_at'],reverse=True)
def list_printers():
    jobs=list_jobs();result=[]
    for p in allrows('printers'):
        active=[j for j in jobs if j['printer_id']==p['id'] and j['status'] in ['Queued','Sent to Controller','Printing']]
        p.update(queue_length=len(active),status='Offline' if not p['enabled'] else 'Busy' if active else 'Online',utilization=min(100,round(sum(j['quote']['pages'] for j in jobs if j['printer_id']==p['id'] and j['status']=='Completed')/10)))
        result.append(p)
    return result

# Administrator session

@app.post("/api/admin/login")
def admin_login():
    data = body()

    username = str(data.get("username", ""))
    password = str(data.get("password", ""))

    if not config.ADMIN_USERNAME or not config.ADMIN_PASSWORD:
        raise Forbidden("Administrator credentials are not configured.")

    username_correct = hmac.compare_digest(
        username.encode('utf-8'),
        config.ADMIN_USERNAME.encode('utf-8'),
    )

    password_correct = hmac.compare_digest(
        password.encode('utf-8'),
        config.ADMIN_PASSWORD.encode('utf-8'),
    )

    if not username_correct or not password_correct:
        raise Forbidden("Incorrect username or password.")

    session["admin_authenticated"] = True
    session['admin_user'] = config.ADMIN_USERNAME
    session['admin_expires'] = time.time() + 8*60*60

    return jsonify(
        authenticated=True,
        username=config.ADMIN_USERNAME,
    )


@app.get("/api/admin/session")
def admin_session():
    return jsonify(
        authenticated=is_admin()
    )


@app.post("/api/admin/logout")
def admin_logout():
    session.pop("admin_authenticated", None)
    session.pop('admin_user', None)
    session.pop('admin_expires', None)
    return jsonify(authenticated=False)

@app.get('/api/bootstrap')
def bootstrap():
    jobs=list_jobs();printers=list_printers()
    return jsonify(jobs=jobs,printers=printers,stats=summarize(jobs,printers),pricing=get('pricing','rates'),insights=insights(jobs,printers),profile=get('users','profile'),demo=config.DEMO_MODE,engine='flask')

@app.get('/api/sample.pdf')
def sample_pdf():return send_file(io.BytesIO(sample()),mimetype='application/pdf',download_name='AutoPrint_Sample.pdf')

@app.post('/api/upload')
def upload():
    f=request.files.get('file')
    if not f or not (f.filename or '').lower().endswith('.pdf'):raise BadRequest('Please choose a PDF file.')
    data=f.read()
    if not data.startswith(b'%PDF-'):raise BadRequest('This file is not a valid PDF.')
    a=analyze(data);id=secrets.token_hex(16);(config.UPLOADS/id).write_bytes(data)
    doc={'id':id,'name':secure_filename(f.filename) or 'Document.pdf','analysis':a,'size':len(data),'created_at':now()};put('documents',doc);return jsonify(doc),201

@app.post('/api/documents/analyze')
def analyze_document():return jsonify(get('documents',body().get('document_id')))

@app.get('/api/documents/<id>/file')
def document_file(id):
    doc=get('documents',id);return send_file(config.UPLOADS/id,mimetype='application/pdf',download_name=doc['name'])

@app.post('/api/pricing/calculate')
def price():
    b=body();doc=get('documents',b.get('document_id'));return jsonify(calculate(doc['analysis'],b.get('settings',{}),get('pricing','rates')))

@app.post('/api/orders/create')
def order():
    b=body();doc=get('documents',b.get('document_id'));q=calculate(doc['analysis'],b.get('settings',{}),get('pricing','rates'))
    candidates=[p for p in list_printers() if p['enabled'] and (q['settings']['paper']!='A3' or p['a3']) and (not q['color_pages'] or p['color'])]
    if b.get('printer_id'):candidates=[p for p in candidates if p['id']==b['printer_id']]
    if not candidates:raise BadRequest('No available printer supports these settings. Choose another printer or paper size.')
    p=min(candidates,key=lambda p:p['queue_length']);id='AP-'+str(datetime.now().year)+'-'+secrets.token_hex(3).upper();at=now()
    job={'id':id,'document_id':doc['id'],'document_name':doc['name'],'settings':q['settings'],'quote':q,'amount':q['amount'],'printer_id':p['id'],'status':'Payment Pending','payment_status':'Pending','payment_mode':'test','created_at':at,'updated_at':at,'seed':False,'timeline':[{'status':'Uploaded','at':doc['created_at']},{'status':'Analyzed','at':doc['created_at']},{'status':'Payment Pending','at':at}]}
    put('print_jobs',job);return jsonify(job),201

@app.get('/api/jobs')
@app.get('/api/orders')
def jobs():return jsonify(list_jobs())
@app.get('/api/jobs/<id>')
@app.get('/api/orders/<id>')
def job(id):return jsonify(get('print_jobs',id))

@app.post('/api/payment/create')
def payment_create():
    job=get('print_jobs',body().get('job_id'))
    if job['status'] not in ['Payment Pending','Payment Failed']:raise BadRequest('This order is not awaiting payment.')
    pending=next((p for p in allrows('payments') if p['job_id']==job['id'] and p['status']=='Pending'),None)
    return jsonify(pending or put('payments',create_payment(job)))
@app.post('/api/payment/verify')
def payment_verify():
    b=body();p=get('payments',b.get('payment_id'));j=get('print_jobs',p['job_id']);p,j=verify_payment(p,j,b.get('result'),config.DEMO_MODE);put('payments',p);put('print_jobs',j);return jsonify(j)

@app.get('/api/queue')
def queue():return jsonify([j for j in reversed(list_jobs()) if j['status'] in ['Queued','Sent to Controller','Printing','Paused'] and j['payment_status']=='Verified'])
@app.post('/api/queue/<id>/<action>')
def queue_action(id,action):
    admin();j=get('print_jobs',id)
    if action=='cancel' and j['status'] in ['Payment Pending','Payment Failed','Queued','Paused','Failed'] :transition(j,'Cancelled')
    elif action=='pause' and j['status']=='Queued':transition(j,'Paused')
    elif action=='resume' and j['status']=='Paused':transition(j,'Queued');j.pop('started_at',None)
    elif action=='retry' and j['status']=='Failed' and j['payment_status']=='Verified' and not j['seed']:transition(j,'Queued');j.pop('started_at',None)
    elif action=='reassign' and j['status'] in ['Queued','Paused']:
        p=get('printers',body().get('printer_id'))
        if not p['enabled'] or j['quote']['color_pages'] and not p['color'] or j['settings']['paper']=='A3' and not p['a3']:raise BadRequest('This printer does not support the job.')
        j['printer_id']=p['id']
    else:raise BadRequest('This action is unavailable at the current printing stage.')
    put('print_jobs',j);return jsonify(j)

@app.get('/api/printers')
def printers():return jsonify(list_printers())
@app.post('/api/printers/register')
def register():
    admin();b=body();name=str(b.get('name','')).strip()
    if not name or len(name)>60:raise BadRequest('Enter a printer name (1–60 characters).')
    p={'id':'pi-'+secrets.token_hex(3),'name':name,'model':str(b.get('model','New printer'))[:80],'location':str(b.get('location','Campus'))[:100],'connection':'Wi-Fi','enabled':True,'color':True,'a3':False,'paper_level':None,'simulated':config.SIMULATION};return jsonify(put('printers',p)),201
@app.post('/api/printers/<id>/<action>')
def printer_action(id,action):
    admin();p=get('printers',id)
    if action=='toggle':
        if any(j['printer_id']==id and j['status'] in ['Printing','Sent to Controller'] for j in list_jobs()):raise BadRequest('Wait for the active print to finish before disabling this printer.')
        p['enabled']=not p['enabled'];put('printers',p)
    elif action=='test':
        if not p['enabled']:raise BadRequest('Enable this printer before running a test.')
        put('printer_status',{'id':id,'last_test':now(),'status':'simulated_ok' if config.SIMULATION else 'awaiting_agent'})
    else:raise NotFound()
    return jsonify(p)

@app.route('/api/pricing',methods=['GET','POST'])
def pricing():
    if request.method=='POST':
        admin();b=body();p={'id':'rates'}
        for k in DEFAULT_PRICING:
            try:v=float(b[k])
            except (KeyError,TypeError,ValueError):raise BadRequest('Enter a valid rate for each print option.')
            if not 0<v<=1000:raise BadRequest('Rates must be greater than ₹0 and at most ₹1,000.')
            p[k]=round(v,2)
        put('pricing',p)
    return jsonify(get('pricing','rates'))
@app.route('/api/settings',methods=['GET','POST'])
def settings():
    p=get('users','profile')
    if request.method=='POST':
        b=body();name=str(b.get('name','')).strip()
        if not 1<=len(name)<=60:raise BadRequest('Enter a display name (1–60 characters).')
        p.update(name=name,email=str(b.get('email',''))[:120],notify=bool(b.get('notify')),default_duplex=bool(b.get('default_duplex')));put('users',p)
    return jsonify(p)
@app.get('/api/analytics/dashboard')
@app.get('/api/analytics/resources')
def analytics():
    days=int(request.args.get('days',7));start=request.args.get('start');end=request.args.get('end')
    if start and end:
        try:
            if not 0<=(datetime.fromisoformat(end)-datetime.fromisoformat(start)).days<=92:raise ValueError()
        except ValueError:raise BadRequest('Select a date range of up to 93 days.')
    return jsonify(summarize(list_jobs(),list_printers(),min(30,max(1,days)),start,end,request.args.get('source','all')))
@app.get('/api/ai/insights')
def ai_insights():return jsonify(insights(list_jobs(),list_printers()))

@app.post('/api/print-agent/jobs/next')
def agent_next():
    pid=body().get('printer_id');printer=get('printers',pid)
    if not printer['enabled']:return jsonify(job=None)
    if any(j['printer_id']==pid and j['status'] in ['Sent to Controller','Printing'] for j in list_jobs()):return jsonify(job=None)
    row=next((j for j in reversed(list_jobs()) if j['printer_id']==pid and j['status']=='Queued' and j['payment_status']=='Verified' and not j['seed'] and (j['payment_mode']!='test' or os.getenv('ALLOW_TEST_PRINTING')=='true')),None)
    if row:row['started_at']=now();transition(row,'Sent to Controller');put('print_jobs',row)
    return jsonify(job=row)
@app.get('/api/print-agent/jobs/<id>/document')
def agent_download(id):
    j=get('print_jobs',id)
    if j['payment_status']!='Verified' or j['status']!='Sent to Controller':raise Forbidden('Job is not authorized for printing.')
    doc=get('documents',j['document_id']);data=prepare((config.UPLOADS/doc['id']).read_bytes(),j['settings'],j['quote']['selected_pages']);return send_file(io.BytesIO(data),mimetype='application/pdf')
@app.post('/api/print-agent/jobs/<id>/status')
def agent_status(id):
    j=get('print_jobs',id);requested={'received':'Sent to Controller','printing':'Printing','completed':'Completed','failed':'Failed'}.get(body().get('status'))
    allowed={'Sent to Controller':['Sent to Controller','Printing','Failed'],'Printing':['Completed','Failed']}
    if requested==j['status']:return jsonify(j)
    if requested not in allowed.get(j['status'],[]):raise BadRequest('Invalid controller status transition.')
    transition(j,requested);put('print_jobs',j);return jsonify(j)

if __name__=='__main__':app.run(host='127.0.0.1',port=int(os.getenv('PORT','5000')),debug=False,threaded=True)
