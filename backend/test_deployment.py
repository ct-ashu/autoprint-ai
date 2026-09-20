"""Render integration checks. Build frontend first, then run this file with Python."""
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import unittest

temporary = tempfile.TemporaryDirectory()
os.environ.update(
    DATA_DIR=temporary.name,
    APP_ENV='production',
    SECRET_KEY=secrets.token_hex(32),
    ADMIN_USERNAME='test-admin',
    ADMIN_PASSWORD=secrets.token_urlsafe(24),
    ADMIN_TOKEN='',
    PRINT_AGENT_TOKEN='',
    PRINT_MODE='simulation',
    DEMO_MODE='true',
)
import app as server

ORIGIN = 'https://demo.onrender.com'


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        server.app.config['TESTING'] = True
        server.login_attempts.clear()
        self.client = server.app.test_client()

    def get(self, path, **kwargs):
        response = self.client.get(path, base_url=ORIGIN, buffered=True, **kwargs)
        self.addCleanup(response.close)
        return response

    def post(self, path, data):
        return self.client.post(path, base_url=ORIGIN, json=data,
                                headers={'Origin': ORIGIN})

    def login(self):
        return self.post('/api/admin/login', {
            'username': server.config.ADMIN_USERNAME,
            'password': server.config.ADMIN_PASSWORD,
        })

    def test_health_and_public_routes(self):
        self.assertTrue((server.config.FRONTEND_DIST / 'index.html').is_file(),
                        'Run npm --prefix frontend run build before this test.')
        health = self.get('/healthz')
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json, {'status': 'ok'})
        self.assertNotIn('Set-Cookie', health.headers)
        self.assertIsNone(self.client.get_cookie('session', domain='demo.onrender.com'))
        for path in ['/', '/new', '/admin/login', '/admin/pricing', '/jobs/example']:
            page = self.get(path)
            self.assertEqual(page.status_code, 200, path)
            self.assertEqual(page.mimetype, 'text/html')
            self.assertIn('<div id="root">', page.text)
        js_path = re.search(r'src="([^"]+\.js)"', self.get('/').text).group(1)
        script = self.get(js_path)
        self.assertEqual(script.status_code, 200)
        self.assertIn('max-age=31536000', script.headers['Cache-Control'])
        self.assertEqual(self.get('/pdf-assets/pdf.worker.min.mjs').status_code, 200)
        for path in ['/api/does-not-exist', '/.env', '/assets/missing.js', '/pdf-assets/missing.wasm']:
            response = self.get(path)
            self.assertEqual(response.status_code, 404, path)
            self.assertEqual(response.mimetype, 'application/json')
        self.assertNotIn('import io,os', self.get('/backend/app.py').text)

    def test_admin_session_logout_and_expiry(self):
        self.assertFalse(self.get('/api/admin/session').json['authenticated'])
        rates = self.get('/api/pricing').json
        self.assertEqual(self.post('/api/pricing', rates).status_code, 403)
        self.assertEqual(self.post('/api/admin/login', {'username': 'admin', 'password': 'admin'}).status_code, 403)
        response = self.login()
        self.assertEqual(response.status_code, 200, response.json)
        cookie = response.headers['Set-Cookie']
        for flag in ['Secure', 'HttpOnly', 'SameSite=Strict']:
            self.assertIn(flag, cookie)
        self.assertTrue(self.get('/api/admin/session').json['authenticated'])
        self.assertEqual(self.post('/api/pricing', rates).status_code, 200)
        with self.client.session_transaction(base_url=ORIGIN) as session:
            workspace = session['workspace']
            session['admin_expires'] = 0
        self.assertFalse(self.get('/api/admin/session').json['authenticated'])
        self.assertEqual(self.post('/api/pricing', rates).status_code, 403)
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.post('/api/admin/logout', {}).status_code, 200)
        self.assertFalse(self.get('/api/admin/session').json['authenticated'])
        self.assertEqual(self.post('/api/pricing', rates).status_code, 403)
        with self.client.session_transaction(base_url=ORIGIN) as session:
            self.assertEqual(session['workspace'], workspace)

    def test_https_proxy_and_cross_origin(self):
        credentials = {'username': server.config.ADMIN_USERNAME,
                       'password': server.config.ADMIN_PASSWORD}
        response = self.client.post('/api/admin/login', base_url='http://demo.onrender.com',
            json=credentials, headers={'X-Forwarded-Proto': 'https', 'Origin': ORIGIN})
        self.assertEqual(response.status_code, 200, response.json)
        for origin in ['https://unrelated.example', 'http://localhost:4173']:
            blocked = self.client.post('/api/admin/login', base_url='http://demo.onrender.com',
                json=credentials, headers={'X-Forwarded-Proto': 'https', 'Origin': origin})
            self.assertEqual(blocked.status_code, 403)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_login_limit_survives_new_cookies(self):
        for attempt in range(11):
            client = server.app.test_client()
            response = client.post('/api/admin/login', base_url=ORIGIN,
                json={'username': 'incorrect', 'password': 'incorrect'})
            self.assertEqual(response.status_code, 403 if attempt < 10 else 429)

    def test_production_rejects_missing_credentials(self):
        for key in ['SECRET_KEY', 'ADMIN_PASSWORD']:
            environment = dict(os.environ, **{key: ''})
            result = subprocess.run([sys.executable, '-c', 'import config'],
                cwd=Path(__file__).resolve().parent, env=environment,
                capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(key, result.stderr)


if __name__ == '__main__':
    try:
        unittest.main(verbosity=2)
    finally:
        temporary.cleanup()
