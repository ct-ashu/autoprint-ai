"""SQLite repository; ownership is enforced on every record operation."""
import sqlite3,json,os
from pathlib import Path
TABLES=['users','documents','print_jobs','payments','printers','printer_status','pricing','analytics','resource_usage','ai_insights']
class Store:
    def __init__(self,path):
        Path(path).parent.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(path,timeout=20)
        self.db.execute('PRAGMA journal_mode=WAL')
        for table in TABLES:
            self.db.execute(f'CREATE TABLE IF NOT EXISTS {table}(id TEXT NOT NULL, workspace TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (workspace,id))')
    def all(self,table,workspace):
        assert table in TABLES
        return [json.loads(r[0]) for r in self.db.execute(f'SELECT data FROM {table} WHERE workspace=?',(workspace,))]
    def get(self,table,workspace,id):
        assert table in TABLES
        r=self.db.execute(f'SELECT data FROM {table} WHERE workspace=? AND id=?',(workspace,id)).fetchone()
        return json.loads(r[0]) if r else None
    def put(self,table,workspace,data):
        assert table in TABLES
        self.db.execute(f'INSERT INTO {table}(id,workspace,data) VALUES(?,?,?) ON CONFLICT(workspace,id) DO UPDATE SET data=excluded.data',(data['id'],workspace,json.dumps(data)));self.db.commit();return data
    def close(self): self.db.close()
