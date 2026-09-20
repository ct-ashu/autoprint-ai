import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { localEnvironment } from "./preview-api.mjs";
import handler from "../worker/index.js";
import { Store } from "../worker/store.js";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "autoprint-test-"));
const env = await localEnvironment(process.cwd(), temp);
let cookie = "";
async function call(route, body, other = false) {
  const headers = {};
  if (cookie && !other) headers.Cookie = cookie;
  let method = "GET";
  if (body) {
    method = "POST";
    if (!(body instanceof FormData))
      headers["Content-Type"] = "application/json";
  }
  const response = await handler.fetch(
    new Request("http://localhost/api" + route, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    }),
    env,
  );
  if (response.headers.get("set-cookie") && !other)
    cookie = response.headers.get("set-cookie").split(";")[0];
  const data = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : await response.arrayBuffer();
  return { status: response.status, data };
}
try {
  const init = await call("/bootstrap");
  assert.equal(init.status, 200);
  assert.equal(init.data.stats.completed, 44);
  const pdf = await call("/sample.pdf");
  const form = new FormData();
  form.append(
    "file",
    new File([pdf.data], "sample.pdf", { type: "application/pdf" }),
  );
  form.append(
    "analysis",
    JSON.stringify({
      total_pages: 6,
      pages: Array.from({ length: 6 }, (_, i) => ({
        blank: i === 2,
        color: i === 1 || i === 4,
        coverage: 2,
      })),
    }),
  );
  const upload = await call("/upload", form);
  assert.equal(upload.status, 201, JSON.stringify(upload.data));
  const doc = upload.data;
  assert.equal(
    (await call("/documents/" + doc.id + "/file", undefined, true)).status,
    404,
  );
  const settings = {
    copies: 2,
    paper: "A4",
    mode: "bw",
    duplex: true,
    nup: 1,
    remove_blank: true,
    range: "",
    orientation: "auto",
  };
  const quote = await call("/pricing/calculate", {
    document_id: doc.id,
    settings,
  });
  assert.equal(quote.data.amount, 8);
  assert.equal(quote.data.sheets, 6);
  assert.equal(
    (
      await call("/pricing/calculate", {
        document_id: doc.id,
        settings: { ...settings, range: "8" },
      })
    ).status,
    400,
  );
  const order = await call("/orders/create", {
    document_id: doc.id,
    settings,
    amount: 0.01,
  });
  assert.equal(order.data.amount, 8);
  const j = order.data;
  assert.equal((await call("/queue")).data.length, 0);
  const p = await call("/payment/create", { job_id: j.id });
  const failed = await call("/payment/verify", {
    payment_id: p.data.id,
    result: "failed",
  });
  assert.equal(failed.data.status, "Payment Failed");
  const next = await call("/payment/create", { job_id: j.id });
  const paid = await call("/payment/verify", {
    payment_id: next.data.id,
    result: "success",
  });
  assert.equal(paid.data.status, "Queued");
  const again = await call("/payment/verify", {
    payment_id: next.data.id,
    result: "success",
  });
  assert.equal(again.data.payment_status, "Verified");
  const w = cookie.split("=")[1],
    store = new Store(env.DB, w),
    job = await store.get("print_jobs", j.id);
  job.started_at = new Date(Date.now() - 40000).toISOString();
  await store.put("print_jobs", job);
  const done = await call("/jobs/" + j.id);
  assert.equal(done.data.status, "Completed");
  const stats = await call("/analytics/resources?source=new");
  assert.equal(stats.data.saved, 6);
  assert.equal(stats.data.pages, 10);
  assert.equal(
    (await call("/print-agent/jobs/next", { printer_id: "pi-01" })).status,
    503,
  );
  assert.equal((await call("/pricing", { a4_bw: -1 })).status, 400);
  console.log(
    "PASS: hosted API persistence, ownership, upload validation, authoritative pricing, test payments, queue, and analytics.",
  );
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
