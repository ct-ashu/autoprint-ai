"""One process keeps the demo's SQLite queue lock and rate limit consistent."""
import os

bind = f"0.0.0.0:{os.getenv('PORT', '10000')}"
workers = 1
worker_class = 'gthread'
threads = 4
timeout = 120
graceful_timeout = 30
accesslog = '-'
errorlog = '-'
capture_output = True
control_socket_disable = True
