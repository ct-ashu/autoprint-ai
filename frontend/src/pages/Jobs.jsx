import React, { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowUpRight,
  Printer,
  Check,
  Clock,
  Download,
  Leaf,
  ArrowLeft,
  RotateCw,
  FileText,
  Pause,
  Play,
  X,
  Server,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  Heading,
  Card,
  FileLabel,
  Badge,
  Loading,
  Empty,
  Modal,
  Field,
  ErrorNotice,
} from "../components/UI";
import { api, date, time, money, humanMode } from "../services/api";
export default function Jobs({ queue = false, admin = false }) {
  const { data, refresh, error } = useWorkspace(),
    [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || ""),
    [status, setStatus] = useState("All"),
    [printer, setPrinter] = useState(params.get("printer") || ""),
    [source, setSource] = useState("all"),
    [confirm, setConfirm] = useState(null),
    [targetPrinter, setTargetPrinter] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data)
    return error ? (
      <ErrorNotice error={error} onRetry={refresh} />
    ) : (
      <Loading />
    );
  let jobs = data.jobs.filter(
    (j) =>
      (!queue ||
        (["Queued", "Sent to Controller", "Printing", "Paused"].includes(
          j.status,
        ) &&
          j.payment_status === "Verified")) &&
      (status === "All" || j.status === status) &&
      (!printer || j.printer_id === printer) &&
      (source === "all" || Boolean(j.seed) === (source === "sample")) &&
      (!q ||
        (j.id + " " + j.document_name).toLowerCase().includes(q.toLowerCase())),
  );
  if (queue) jobs = jobs.slice().reverse();
  async function action() {
    setBusy(true);
    try {
      await api(
        `/queue/${confirm.job.id}/${confirm.action}`,
        confirm.action === "reassign" ? { printer_id: targetPrinter } : {},
      );
      toast.success("Print job updated.");
      setConfirm(null);
      await refresh();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  function exportCSV() {
    const rows = [
      [
        "Job ID",
        "Document",
        "Pages",
        "Copies",
        "Amount (INR)",
        "Status",
        "Data source",
      ],
      ...jobs.map((j) => [
        j.id,
        j.document_name,
        j.quote.pages,
        j.settings.copies,
        j.amount,
        j.status,
        j.seed ? "Sample" : "Your upload",
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v)
                .replaceAll('"', '""')
                .replace(/^[=+@-]/, "'$&") +
              '"',
          )
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "AutoPrint_Jobs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <Heading
        title={queue ? "Print queue" : admin ? "All orders" : "My print jobs"}
        eyebrow={queue ? "FROM QUEUE TO COMPLETE" : "YOUR PRINTING HISTORY"}
        subtitle={
          queue
            ? "Follow the flow. Your next print is on its way."
            : "Every document, every detail, in one place."
        }
      >
        <button className="button" onClick={exportCSV}>
          <Download size={17} />
          Export
        </button>
        <Link className="button primary" to="/new">
          <Plus size={17} />
          New print
        </Link>
      </Heading>
      {queue && (
        <div className="queue-flow">
          {[
            [Server, "Secure backend", "Payment verified"],
            [Layers, "Smart queue", jobs.length + " active jobs"],
            [Printer, "Print controller", "Simulation mode"],
            [CheckCircle2, "Ready to collect", "Track your job below"],
          ].map(([Icon, title, text], i) => (
            <React.Fragment key={title}>
              {i > 0 && <span className="flow-connector" />}
              <div>
                <Icon size={23} />
                <span>
                  <b>{title}</b>
                  <small>{text}</small>
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
      <Card>
        <div className="filter-row">
          <label className="search-field">
            <Search size={17} />
            <input
              placeholder="Search document or job ID…"
              aria-label="Filter jobs"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label="Status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              "All",
              ...(queue
                ? ["Queued", "Sent to Controller", "Printing", "Paused"]
                : [
                    "Completed",
                    "Printing",
                    "Queued",
                    "Payment Pending",
                    "Payment Failed",
                    "Failed",
                    "Cancelled",
                    "Paused",
                  ]),
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Printer filter"
            value={printer}
            onChange={(e) => setPrinter(e.target.value)}
          >
            <option value="">All printers</option>
            {data.printers.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Data source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All records</option>
            <option value="new">Your uploads</option>
            <option value="sample">Sample data</option>
          </select>
        </div>
        {jobs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {queue && <th>QUEUE</th>}
                  <th>DOCUMENT</th>
                  <th>JOB ID</th>
                  <th>PAGES</th>
                  <th>PRINTER</th>
                  <th>{queue ? "PAYMENT" : "AMOUNT"}</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j, i) => (
                  <tr key={j.id}>
                    {queue && <td className="queue-number">{i + 1}</td>}
                    <td>
                      <Link to={"/jobs/" + j.id}>
                        <FileLabel
                          name={j.document_name}
                          meta={`${j.seed ? "Sample · " : ""}${date(j.created_at)} · ${j.settings.duplex ? "Duplex" : "Single-sided"}`}
                        />
                      </Link>
                    </td>
                    <td className="mono">{j.id}</td>
                    <td>{j.quote.pages * j.settings.copies}</td>
                    <td>
                      {data.printers.find((p) => p.id === j.printer_id)?.name}
                    </td>
                    <td>
                      {queue ? (
                        <Badge status={j.payment_status} />
                      ) : (
                        money(j.amount)
                      )}
                    </td>
                    <td>
                      <Badge status={j.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link
                          className="icon-button"
                          to={"/jobs/" + j.id}
                          aria-label={"View " + j.id}
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                        {(queue || admin) &&
                          [
                            "Queued",
                            "Paused",
                            "Failed",
                            "Payment Pending",
                            "Payment Failed",
                          ].includes(j.status) && (
                            <>
                              {j.status === "Queued" && (
                                <button
                                  className="icon-button"
                                  aria-label={"Pause " + j.id}
                                  title="Pause job"
                                  onClick={() =>
                                    setConfirm({ job: j, action: "pause" })
                                  }
                                >
                                  <Pause size={16} />
                                </button>
                              )}
                              {j.status === "Paused" && (
                                <button
                                  className="icon-button"
                                  aria-label={"Resume " + j.id}
                                  title="Resume job"
                                  onClick={() =>
                                    setConfirm({ job: j, action: "resume" })
                                  }
                                >
                                  <Play size={16} />
                                </button>
                              )}
                              {j.status === "Failed" && !j.seed && (
                                <button
                                  className="icon-button"
                                  aria-label={"Retry " + j.id}
                                  onClick={() =>
                                    setConfirm({ job: j, action: "retry" })
                                  }
                                >
                                  <RotateCw size={16} />
                                </button>
                              )}
                              {["Queued", "Paused"].includes(j.status) && (
                                <button
                                  className="icon-button"
                                  aria-label={"Reassign " + j.id}
                                  title="Reassign printer"
                                  onClick={() => {
                                    setTargetPrinter(j.printer_id);
                                    setConfirm({ job: j, action: "reassign" });
                                  }}
                                >
                                  <Printer size={16} />
                                </button>
                              )}
                              <button
                                className="icon-button danger"
                                aria-label={"Cancel " + j.id}
                                title="Cancel job"
                                onClick={() =>
                                  setConfirm({ job: j, action: "cancel" })
                                }
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={queue ? "The queue is all clear." : "No matching print jobs"}
            text={
              queue
                ? "Upload a document and make your first smart print."
                : "Try another filter, or upload a document to get started."
            }
            action={
              <Link className="button primary" to="/new">
                <Plus size={16} />
                Start a print
              </Link>
            }
          />
        )}
        <div className="table-footer">
          <span>
            {jobs.length} {queue ? "active jobs" : "records"}
          </span>
          <span>Updates every 4 seconds · Sample records are labeled</span>
        </div>
      </Card>
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={
          confirm
            ? confirm.action[0].toUpperCase() +
              confirm.action.slice(1) +
              " print job"
            : ""
        }
      >
        <p className="modal-copy">
          {confirm?.job.document_name} · {confirm?.job.id}
        </p>
        {confirm?.action === "reassign" && (
          <Field label="New printer">
            <select
              value={targetPrinter}
              onChange={(e) => setTargetPrinter(e.target.value)}
            >
              {data.printers
                .filter((p) => p.enabled)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {confirm?.action === "cancel" && (
          <p className="muted">
            This removes the job from the queue. You can create a new job using
            the same document.
          </p>
        )}
        <div className="modal-actions">
          <button className="button" onClick={() => setConfirm(null)}>
            Go back
          </button>
          <button className="button primary" disabled={busy} onClick={action}>
            Confirm {confirm?.action}
          </button>
        </div>
      </Modal>
    </>
  );
}
export function JobDetail() {
  const { id } = useParams(),
    { data, refresh, error } = useWorkspace(),
    [busy, setBusy] = useState(false);
  if (!data)
    return error ? (
      <ErrorNotice error={error} onRetry={refresh} />
    ) : (
      <Loading />
    );
  const j = data.jobs.find((j) => j.id === id);
  if (!j)
    return (
      <Empty
        title="Job not found"
        text="This job is not part of your current workspace."
        action={
          <Link to="/jobs" className="button">
            Back to jobs
          </Link>
        }
      />
    );
  const p = data.printers.find((p) => p.id === j.printer_id),
    active = data.jobs
      .filter(
        (x) =>
          x.printer_id === j.printer_id &&
          ["Queued", "Printing", "Sent to Controller"].includes(x.status),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const position = active.findIndex((x) => x.id === id) + 1;
  const stages = [
    "Uploaded",
    "Analyzed",
    "Payment Pending",
    "Payment Verified",
    "Queued",
    "Sent to Controller",
    "Printing",
    "Completed",
  ];
  let current = stages.indexOf(j.status);
  async function pay() {
    setBusy(true);
    try {
      const p = await api("/payment/create", { job_id: id });
      await api("/payment/verify", { payment_id: p.id, result: "success" });
      await refresh();
      toast.success("Test payment verified.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link to="/jobs" className="back-link">
        <ArrowLeft size={16} />
        Back to my jobs
      </Link>
      <Heading
        title={
          j.status === "Completed"
            ? "All printed. All set."
            : "Your print, in progress."
        }
        eyebrow={j.id}
        subtitle={
          j.seed
            ? "This is a seeded sample record."
            : `Created ${date(j.created_at)} at ${time(j.created_at)}`
        }
      >
        <Badge status={j.status} />

                 {j.status === "Completed" && (
                  <Link className="button primary" to="/new">
                    <Plus size={16} />
                    Print another document
                  </Link>
                )}
        {j.document_id && (
          <Link className="button" to={"/new?document=" + j.document_id}>
            <RotateCw size={16} />
            Print again
          </Link>
        )}
      </Heading>
      <div className="detail-grid">
        <Card title="Job timeline">
          <div className="tracking-status">
             {j.status === "Printing" ? (
    <div
      className="printing-animation"
      role="status"
      aria-label="Your document is printing"
    >
      <div className="printing-paper paper-entering">
        <span />
        <span />
        <span />
      </div>

      <div className="printing-machine">
        <Printer size={42} />
        <div className="printer-light" />
        <div className="printer-slot" />
      </div>

      <div className="printing-paper paper-leaving">
        <span />
        <span />
        <span />
      </div>

      <div className="printing-caption">
        Printing
        <span className="printing-dots">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  ) : (
    <span
      className={
        "tracking-icon " +
        (j.status === "Completed" ? "green" : "blue")
      }
    >
      <Printer size={34} />
    </span>
  )}
            <h2>
              {j.status === "Completed" ? "Your document is ready." : j.status}
            </h2>
           {j.status === "Completed" ? (
                    <p>Printing completed successfully.</p>
                  ) : j.status === "Paused" ? (
                    <p>This job is paused. Resume it from the print queue.</p>
                  ) : position ? (
                    <div className="queue-status-highlight">
                      <div className="queue-status-item">
                        <span>Queue position</span>
                        <strong>#{position}</strong>
                      </div>

                      <div className="queue-status-item">
                        <Clock size={18} />
                        <span>Estimated time</span>
                        <strong>{Math.max(1, position) * 28} sec</strong>
                      </div>
                    </div>
                  ) : (
                    <p>Review your job details below.</p>
                  )}
          </div>
          {["Payment Pending", "Payment Failed"].includes(j.status) && (
            <button
              className="button primary full-width"
              disabled={busy}
              onClick={pay}
            >
              Verify test payment · {money(j.amount)}
            </button>
          )}
          <ol className="timeline">
            {stages.map((s, i) => {
              const event = j.timeline.find((e) => e.status === s);
              const done = j.seed ? i === 7 : !!event;
              return (
                <li
                  className={done ? "done" : i === current ? "current" : ""}
                  key={s}
                >
                  <span>{done ? <Check size={14} /> : <i />}</span>
                  <div>
                    <b>{s}</b>
                    <small>
                      {event
                        ? time(event.at)
                        : j.seed
                          ? "Sample record"
                          : i > current
                            ? "Upcoming"
                            : ""}
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
          {["Failed", "Cancelled", "Paused", "Payment Failed"].includes(
            j.status,
          ) && <div className="notice">Current status: {j.status}</div>}
        </Card>
        <div className="detail-aside">
          <Card title="Print details">
            <FileLabel name={j.document_name} meta={j.id} />
            <dl className="review-list">
              {[
                ["Printer", p?.name],
                ["Location", p?.location],
                ["Pages", j.quote.pages],
                ["Copies", j.settings.copies],
                ["Paper", j.settings.paper],
                ["Mode", humanMode(j.settings.mode)],
                ["Sides", j.settings.duplex ? "Double-sided" : "Single-sided"],
                ["Sheets", j.quote.sheets],
                ["Payment", j.payment_status + " (test)"],
                ["Amount", money(j.amount)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {j.document_id && (
              <a
                className="button full-width"
                href={"/api/documents/" + j.document_id + "/file"}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={16} />
                View original document
              </a>
            )}
          </Card>
          <div className="impact-card">
            <Leaf size={27} />
            <strong>{j.quote.saved_sheets} sheets saved</strong>
            <p>Small choices make a real difference to your paper estimate.</p>
          </div>
        </div>
      </div>
    </>
  );
}
