import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Store } from "./store.js";
import {
  fail,
  now,
  price,
  summary,
  insights,
  DEFAULT_PRICING,
  transition,
} from "./domain.js";
const uuid = () => crypto.randomUUID().replaceAll("-", "");
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
async function sample() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 6; i++) {
    const p = pdf.addPage([595, 842]);
    if (i === 3) continue;
    const color = [2, 5].includes(i) ? rgb(0.15, 0.4, 0.8) : rgb(0, 0, 0);
    p.drawText("AUTOPRINT AI / SAMPLE DOCUMENT", {
      x: 54,
      y: 780,
      size: 12,
      font,
      color,
    });
    p.drawText(`Electrical Engineering - Lab Record / Page ${i}`, {
      x: 54,
      y: 735,
      size: 16,
      font,
    });
    for (let k = 0; k < 10; k++)
      p.drawText(
        "Observation: Record the readings and compare the calculated results.",
        { x: 54, y: 680 - k * 24, size: 10, font },
      );
    if ([2, 5].includes(i))
      p.drawRectangle({ x: 54, y: 330, width: 250, height: 70, color });
  }
  return pdf.save();
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      let response = await env.ASSETS.fetch(request);
      if (
        response.status === 404 &&
        request.method === "GET" &&
        !/\.[a-z0-9]+$/i.test(url.pathname)
      ) {
        url.pathname = "/index.html";
        response = await env.ASSETS.fetch(new Request(url, request));
      }
      return response;
    }
    let workspace = request.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)ap_workspace=([a-f0-9]{48})(?:;|$)/)?.[1];
    let fresh = false;
    if (!workspace) {
      workspace = uuid() + uuid().slice(0, 16);
      fresh = true;
    }
    const headers = { ...JSON_HEADERS };
    if (fresh)
      headers["Set-Cookie"] =
        `ap_workspace=${workspace}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${url.protocol === "https:" ? "; Secure" : ""}`;
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    try {
      if (!env.DB || !env.BUCKET)
        fail(
          "Your workspace is temporarily unavailable. Please try again shortly.",
          503,
        );
      const origin = request.headers.get("Origin");
      if (
        !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
        origin &&
        origin !== url.origin
      )
        fail("Request origin is not allowed.", 403);
      if (Number(request.headers.get("Content-Length") || 0) > 11 * 1024 * 1024)
        fail("Files must be 10 MB or smaller.", 413);
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      const store = new Store(env.DB, workspace);
      await store.seed();
      const path = url.pathname.replace("/api", ""),
        method = request.method;
      if (method === "POST") {
        const win = Math.floor(Date.now() / 60000);
        const r = await env.DB.prepare(
          "INSERT INTO rate_limits(workspace,window,count) VALUES(?,?,1) ON CONFLICT(workspace) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count",
        )
          .bind(workspace, win)
          .first();
        if (r.count > 60)
          fail("Too many requests. Please try again in a minute.", 429);
      }
      await store.tick();
      let b = {};
      if (method === "POST" && path !== "/upload") {
        try {
          b = await request.json();
        } catch {
          fail("A valid JSON request body is required.");
        }
      }
      if (path === "/bootstrap" && method === "GET") {
        const jobs = await store.jobs(),
          printers = await store.printers(jobs);
        return json({
          jobs,
          printers,
          stats: summary(jobs, printers),
          pricing: await store.get("pricing", "rates"),
          insights: insights(jobs, printers),
          profile: await store.get("users", "profile"),
          demo: true,
          engine: "worker",
        });
      }
      if (path === "/sample.pdf" && method === "GET")
        return new Response(await sample(), {
          headers: {
            ...headers,
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="AutoPrint_Sample.pdf"',
          },
        });
      if (path === "/upload" && method === "POST") {
        const form = await request.formData();
        const file = form.get("file");
        if (
          !file ||
          typeof file === "string" ||
          !file.name.toLowerCase().endsWith(".pdf")
        )
          fail("Please choose a PDF file.");
        if (file.size > 10 * 1024 * 1024)
          fail("Files must be 10 MB or smaller.", 413);
        const bytes = await file.arrayBuffer();
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
          fail("This file is not a valid PDF.");
        let pdf;
        try {
          pdf = await PDFDocument.load(bytes, { updateMetadata: false });
        } catch {
          fail(
            "This PDF could not be read. Please upload an unlocked, valid PDF.",
          );
        }
        const count = pdf.getPageCount();
        if (count < 1 || count > 150)
          fail("Please upload a PDF containing 1–150 pages.");
        let a;
        try {
          a = JSON.parse(form.get("analysis"));
        } catch {
          fail("Document analysis was not included. Please retry the upload.");
        }
        if (
          !a ||
          a.total_pages !== count ||
          !Array.isArray(a.pages) ||
          a.pages.length !== count
        )
          fail("Document analysis did not match the PDF. Please try again.");
        const pages = a.pages.map((p, i) => {
          const size = pdf.getPage(i).getSize();
          return {
            number: i + 1,
            blank: p.blank === true,
            color: p.color === true,
            coverage: Math.max(0, Math.min(100, Number(p.coverage) || 0)),
            width: Math.round(size.width),
            height: Math.round(size.height),
          };
        });
        a = {
          total_pages: count,
          pages,
          blank_pages: pages.filter((p) => p.blank).map((p) => p.number),
          color_pages: pages.filter((p) => p.color).map((p) => p.number),
          bw_pages: pages
            .filter((p) => !p.blank && !p.color)
            .map((p) => p.number),
          engine:
            "PDF.js · browser raster analysis; PDF structure verified by server",
          size: file.size,
        };
        const id = uuid(),
          name =
            file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 140) ||
            "Document.pdf";
        await env.BUCKET.put(workspace + "/" + id, bytes, {
          httpMetadata: { contentType: "application/pdf" },
        });
        const doc = {
          id,
          name,
          analysis: a,
          size: file.size,
          created_at: now(),
        };
        await store.put("documents", doc);
        return json(doc, 201);
      }
      if (path === "/documents/analyze" && method === "POST")
        return json(await store.get("documents", b.document_id));
      let m = path.match(/^\/documents\/([^/]+)\/file$/);
      if (m && method === "GET") {
        const doc = await store.get("documents", m[1]);
        const object = await env.BUCKET.get(workspace + "/" + doc.id);
        if (!object) fail("The document file is unavailable.", 404);
        return new Response(object.body, {
          headers: {
            ...headers,
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${doc.name.replaceAll('"', "_")}"`,
            "Content-Security-Policy": "sandbox; default-src 'none';",
          },
        });
      }
      if (path === "/pricing/calculate" && method === "POST") {
        const doc = await store.get("documents", b.document_id);
        return json(
          price(
            doc.analysis,
            b.settings || {},
            await store.get("pricing", "rates"),
          ),
        );
      }
      if (path === "/orders/create" && method === "POST") {
        const doc = await store.get("documents", b.document_id),
          q = price(
            doc.analysis,
            b.settings || {},
            await store.get("pricing", "rates"),
          ),
          printers = await store.printers(await store.jobs());
        const candidates = printers
          .filter(
            (p) =>
              p.enabled &&
              (q.settings.paper !== "A3" || p.a3) &&
              (!q.color_pages || p.color) &&
              (!b.printer_id || p.id === b.printer_id),
          )
          .sort((a, b) => a.queue_length - b.queue_length);
        if (!candidates.length)
          fail(
            "No available printer supports these settings. Choose another printer or paper size.",
          );
        const id = `AP-${new Date().getUTCFullYear()}-${uuid().slice(0, 8).toUpperCase()}`,
          at = now();
        return json(
          await store.put("print_jobs", {
            id,
            document_id: doc.id,
            document_name: doc.name,
            settings: q.settings,
            quote: q,
            amount: q.amount,
            printer_id: candidates[0].id,
            status: "Payment Pending",
            payment_status: "Pending",
            payment_mode: "test",
            created_at: at,
            updated_at: at,
            seed: false,
            timeline: [
              { status: "Uploaded", at: doc.created_at },
              { status: "Analyzed", at: doc.created_at },
              { status: "Payment Pending", at },
            ],
          }),
          201,
        );
      }
      if (["/jobs", "/orders"].includes(path) && method === "GET")
        return json(await store.jobs());
      m = path.match(/^\/(?:jobs|orders)\/([^/]+)$/);
      if (m && method === "GET")
        return json(await store.get("print_jobs", m[1]));
      if (path === "/payment/create" && method === "POST") {
        const j = await store.get("print_jobs", b.job_id);
        if (!["Payment Pending", "Payment Failed"].includes(j.status))
          fail("This order is not awaiting payment.");
        const pending = (await store.all("payments")).find(
          (p) => p.job_id === j.id && p.status === "Pending",
        );
        return json(
          pending ||
            (await store.put("payments", {
              id: "pay_" + uuid(),
              job_id: j.id,
              amount: j.amount,
              status: "Pending",
              mode: "test",
              created_at: now(),
            })),
        );
      }
      if (path === "/payment/verify" && method === "POST") {
        const p = await store.get("payments", b.payment_id),
          old = await store.get("print_jobs", p.job_id),
          j = structuredClone(old);
        if (p.status === "Verified" || j.payment_status === "Verified")
          return json(j);
        if (!["success", "failed"].includes(b.result))
          fail("Choose a test payment outcome.");
        if (!["Payment Pending", "Payment Failed"].includes(j.status))
          fail("This order can no longer accept payment.");
        p.status = b.result === "success" ? "Verified" : "Failed";
        p.verified_at = now();
        j.payment_status = p.status;
        if (b.result === "success") {
          transition(j, "Payment Verified");
          transition(j, "Queued");
        } else transition(j, "Payment Failed");
        if (!(await store.cas("print_jobs", old, j)))
          return json(await store.get("print_jobs", j.id));
        await store.put("payments", p);
        return json(j);
      }
      if (path === "/queue" && method === "GET")
        return json(
          (await store.jobs())
            .reverse()
            .filter(
              (j) =>
                ["Queued", "Sent to Controller", "Printing", "Paused"].includes(
                  j.status,
                ) && j.payment_status === "Verified",
            ),
        );
      m = path.match(/^\/queue\/([^/]+)\/([^/]+)$/);
      if (m && method === "POST") {
        const old = await store.get("print_jobs", m[1]),
          j = structuredClone(old),
          action = m[2];
        if (
          action === "cancel" &&
          [
            "Payment Pending",
            "Payment Failed",
            "Queued",
            "Paused",
            "Failed",
          ].includes(j.status)
        )
          transition(j, "Cancelled");
        else if (action === "pause" && j.status === "Queued")
          transition(j, "Paused");
        else if (action === "resume" && j.status === "Paused") {
          transition(j, "Queued");
          delete j.started_at;
        } else if (
          action === "retry" &&
          j.status === "Failed" &&
          j.payment_status === "Verified" &&
          !j.seed
        ) {
          transition(j, "Queued");
          delete j.started_at;
        } else if (
          action === "reassign" &&
          ["Queued", "Paused"].includes(j.status)
        ) {
          const p = await store.get("printers", b.printer_id);
          if (
            !p.enabled ||
            (j.quote.color_pages && !p.color) ||
            (j.settings.paper === "A3" && !p.a3)
          )
            fail("This printer does not support the job.");
          j.printer_id = p.id;
        } else
          fail("This action is unavailable at the current printing stage.");
        if (!(await store.cas("print_jobs", old, j)))
          fail("The job changed. Refresh and try again.", 409);
        return json(j);
      }
      if (path === "/printers" && method === "GET")
        return json(await store.printers(await store.jobs()));
      if (path === "/printers/register" && method === "POST") {
        const name = String(b.name || "").trim();
        if (!name || name.length > 60)
          fail("Enter a printer name (1–60 characters).");
        return json(
          await store.put("printers", {
            id: "pi-" + uuid().slice(0, 6),
            name,
            model: String(b.model || "New printer").slice(0, 80),
            location: String(b.location || "Campus").slice(0, 100),
            connection: "Wi-Fi",
            enabled: true,
            color: true,
            a3: false,
            paper_level: null,
            simulated: true,
          }),
          201,
        );
      }
      m = path.match(/^\/printers\/([^/]+)\/([^/]+)$/);
      if (m && method === "POST") {
        const p = await store.get("printers", m[1]),
          action = m[2];
        if (action === "toggle") {
          if (
            (await store.jobs()).some(
              (j) =>
                j.printer_id === p.id &&
                ["Printing", "Sent to Controller"].includes(j.status),
            )
          )
            fail(
              "Wait for the active print to finish before disabling this printer.",
            );
          p.enabled = !p.enabled;
          await store.put("printers", p);
        } else if (action === "test") {
          if (!p.enabled) fail("Enable this printer before running a test.");
          await store.put("printer_status", {
            id: p.id,
            last_test: now(),
            status: "simulated_ok",
          });
        } else fail("Unknown printer action.", 404);
        return json(p);
      }
      if (path === "/pricing") {
        if (method === "POST") {
          const p = { id: "rates" };
          for (const key of Object.keys(DEFAULT_PRICING)) {
            const v = Number(b[key]);
            if (!Number.isFinite(v) || v <= 0 || v > 1000)
              fail("Rates must be greater than ₹0 and at most ₹1,000.");
            p[key] = Math.round(v * 100) / 100;
          }
          await store.put("pricing", p);
        }
        return json(await store.get("pricing", "rates"));
      }
      if (path === "/settings") {
        const p = await store.get("users", "profile");
        if (method === "POST") {
          const name = String(b.name || "").trim();
          if (!name || name.length > 60)
            fail("Enter a display name (1–60 characters).");
          Object.assign(p, {
            name,
            email: String(b.email || "").slice(0, 120),
            notify: !!b.notify,
            default_duplex: !!b.default_duplex,
          });
          await store.put("users", p);
        }
        return json(p);
      }
      if (
        ["/analytics/dashboard", "/analytics/resources"].includes(path) &&
        method === "GET"
      ) {
        const days = Math.min(
            30,
            Math.max(1, Number(url.searchParams.get("days") || 7)),
          ),
          start = url.searchParams.get("start"),
          end = url.searchParams.get("end"),
          source = url.searchParams.get("source");
        if (start || end) {
          const diff = (Date.parse(end) - Date.parse(start)) / 864e5;
          if (
            !start ||
            !end ||
            !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
            !Number.isFinite(diff) ||
            diff < 0 ||
            diff > 92
          )
            fail("Select a valid date range of up to 93 days.");
        }
        if (!Number.isFinite(days)) fail("Choose a valid time period.");
        const jobs = await store.jobs();
        return json(
          summary(jobs, await store.printers(jobs), {
            days,
            start,
            end,
            source,
          }),
        );
      }
      if (path === "/ai/insights" && method === "GET") {
        const jobs = await store.jobs();
        return json(insights(jobs, await store.printers(jobs)));
      }
      if (path.startsWith("/print-agent/"))
        fail(
          "The hosted workspace runs a simulator. Use the included Flask API for a hardware controller.",
          503,
        );
      fail("This API route was not found.", 404);
    } catch (e) {
      if (!e.status) console.error("AutoPrint API", e.message);
      return json(
        {
          error: e.status
            ? e.message
            : "Your workspace could not complete this request. Please try again.",
        },
        e.status || 500,
      );
    }
  },
};
