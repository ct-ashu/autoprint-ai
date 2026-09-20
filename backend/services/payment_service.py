"""Test-only verification. Add signed gateway webhook verification before enabling live payments."""
import secrets
from werkzeug.exceptions import BadRequest
from .queue_service import now,transition

def create(job):return {'id':'pay_'+secrets.token_hex(12),'job_id':job['id'],'amount':job['amount'],'status':'Pending','mode':'test','created_at':now()}
def verify(payment,job,result,enabled=True):
    if not enabled:raise BadRequest('Live payment verification is not configured. Test payments are disabled.')
    if result not in ['success','failed']:raise BadRequest('Choose a test payment outcome.')
    if job['status'] not in ['Payment Pending','Payment Failed'] or payment['status']=='Verified':
        if payment['status']=='Verified':return payment,job
        raise BadRequest('This order can no longer accept payment.')
    status='Verified' if result=='success' else 'Failed';payment['status']=status;payment['verified_at']=now();job['payment_status']=status
    if result=='success':transition(job,'Payment Verified');transition(job,'Queued')
    else:transition(job,'Payment Failed')
    return payment,job
