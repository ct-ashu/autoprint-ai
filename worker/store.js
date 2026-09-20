import { TABLES, seedData, fail, now, transition } from "./domain.js";
export class Store {
  constructor(db, workspace) {
    this.db = db;
    this.w = workspace;
  }
  stmt(table, sql, ...args) {
    if (!TABLES.includes(table)) throw new Error("Invalid table");
    return this.db.prepare(sql).bind(...args);
  }
  async all(t) {
    return (
      await this.stmt(
        t,
        `SELECT data FROM ${t} WHERE workspace=?`,
        this.w,
      ).all()
    ).results.map((r) => JSON.parse(r.data));
  }
  async get(t, id, optional = false) {
    const r = await this.stmt(
      t,
      `SELECT data FROM ${t} WHERE workspace=? AND id=?`,
      this.w,
      String(id || ""),
    ).first();
    if (!r && !optional)
      fail("This record was not found in your workspace.", 404);
    return r ? JSON.parse(r.data) : null;
  }
  putStmt(t, r) {
    return this.stmt(
      t,
      `INSERT INTO ${t}(id,workspace,data) VALUES(?,?,?) ON CONFLICT(workspace,id) DO UPDATE SET data=excluded.data`,
      r.id,
      this.w,
      JSON.stringify(r),
    );
  }
  async put(t, r) {
    await this.putStmt(t, r).run();
    return r;
  }
  async cas(t, old, row) {
    const r = await this.stmt(
      t,
      `UPDATE ${t} SET data=? WHERE workspace=? AND id=? AND data=?`,
      JSON.stringify(row),
      this.w,
      old.id,
      JSON.stringify(old),
    ).run();
    return r.meta.changes > 0;
  }
  async seed() {
    if (await this.get("users", "profile", true)) return;
    const items = seedData(this.w);
    await this.db.batch(
      items.map(([t, r]) =>
        this.stmt(
          t,
          `INSERT OR IGNORE INTO ${t}(id,workspace,data) VALUES(?,?,?)`,
          r.id,
          this.w,
          JSON.stringify(r),
        ),
      ),
    );
  }
  async jobs() {
    return (await this.all("print_jobs")).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }
  async printers(jobs) {
    return (await this.all("printers")).map((p) => {
      const active = jobs.filter(
        (j) =>
          j.printer_id === p.id &&
          ["Queued", "Sent to Controller", "Printing"].includes(j.status),
      );
      return {
        ...p,
        queue_length: active.length,
        status: !p.enabled ? "Offline" : active.length ? "Busy" : "Online",
        utilization: Math.min(
          100,
          Math.round(
            jobs
              .filter((j) => j.printer_id === p.id && j.status === "Completed")
              .reduce((s, j) => s + j.quote.pages, 0) / 10,
          ),
        ),
      };
    });
  }
  async tick() {
    const jobs = await this.jobs();
    for (const p of await this.all("printers")) {
      if (!p.enabled) continue;
      const active = jobs
        .filter(
          (j) =>
            j.printer_id === p.id &&
            j.payment_status === "Verified" &&
            ["Queued", "Sent to Controller", "Printing"].includes(j.status),
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (!active.length) continue;
      const old = active[0],
        j = structuredClone(old);
      if (!j.started_at) {
        j.started_at = now();
        transition(j, "Sent to Controller");
      }
      const elapsed = Date.now() - Date.parse(j.started_at);
      if (elapsed >= 28000) transition(j, "Completed");
      else if (elapsed >= 6000 && j.status !== "Printing")
        transition(j, "Printing");
      if (JSON.stringify(old) !== JSON.stringify(j))
        await this.cas("print_jobs", old, j);
    }
  }
}
