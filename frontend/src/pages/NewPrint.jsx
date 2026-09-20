import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Leaf,
  ArrowRight,
  ArrowLeft,
  Check,
  ShieldCheck,
  Printer,
  Minus,
  Plus,
  Smartphone,
  QrCode,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  Heading,
  Card,
  Field,
  Toggle,
  Busy,
  ErrorNotice,
  FileLabel,
} from "../components/UI";
import { api, uploadPDF, analyzePDF, money, humanMode } from "../services/api";
const stages = [
  "Upload",
  "AI analysis",
  "Print settings",
  "Review",
  "Payment",
  "Track",
];
export default function NewPrint() {
  const { data, refresh } = useWorkspace(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [step, setStep] = useState(0),
    [doc, setDoc] = useState(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false),
    [quote, setQuote] = useState(null),
    [quoteError, setQuoteError] = useState(""),
    [printer, setPrinter] = useState(""),
    [job, setJob] = useState(null),
    [method, setMethod] = useState("UPI"),
    [payFailed, setPayFailed] = useState(false);
  const input = useRef();
  const [settings, setSettings] = useState({
    copies: 1,
    mode: "auto",
    paper: "A4",
    duplex: true,
    range: "",
    nup: 1,
    orientation: "auto",
    remove_blank: false,
  });
  useEffect(() => {
    if (data?.profile)
      setSettings((s) => ({ ...s, duplex: data.profile.default_duplex }));
  }, [data?.profile.default_duplex]);
  useEffect(() => {
    if (params.get("document"))
      api("/documents/analyze", { document_id: params.get("document") })
        .then((d) => {
          setDoc(d);
          setStep(1);
        })
        .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!doc) return;
    let active = true;
    setQuote(null);
    setQuoteError("");
    const t = setTimeout(
      () =>
        api("/pricing/calculate", { document_id: doc.id, settings })
          .then((q) => {
            if (active) setQuote(q);
          })
          .catch((e) => {
            if (active) setQuoteError(e.message);
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [doc, settings]);
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  async function loadFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("This file is larger than 10 MB. Try a smaller PDF.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setError("");
    try {
      const analysis =
        data?.engine === "worker" ? await analyzePDF(file, setProgress) : null;
      const d = await uploadPDF(file, analysis, setProgress);
      setDoc(d);
      setProgress(100);
      setStep(1);
      toast.success("Your document is ready to review.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function order() {
    setBusy(true);
    setError("");
    try {
      const j = await api("/orders/create", {
        document_id: doc.id,
        settings,
        printer_id: printer || undefined,
      });
      setJob(j);
      setStep(4);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function pay(result) {
    setBusy(true);
    setError("");
    try {
      const p = await api("/payment/create", { job_id: job.id, method });
      const j = await api("/payment/verify", { payment_id: p.id, result });
      setJob(j);
      await refresh();
      if (j.payment_status === "Verified") {
        toast.success("Test payment verified. Your job is in the queue.");
        navigate("/jobs/" + j.id);
      } else {
        setPayFailed(true);
        toast.error("Test payment failed. You can retry safely.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const a = doc?.analysis;
  return (
    <>
      <Heading
        title="New print job"
        eyebrow="FROM FILE TO FINISHED"
        subtitle="A few thoughtful choices. A smarter print."
      />
      <ol className="stepper">
        {stages.map((s, i) => (
          <li
            key={s}
            className={i < step ? "done" : i === step ? "current" : ""}
          >
            <span>{i < step ? <Check size={15} /> : i + 1}</span>
            <b>{s}</b>
          </li>
        ))}
      </ol>
      {error && <ErrorNotice error={error} />}
      <div className="wizard-grid">
        <div className="wizard-main">
          {step === 0 && (
            <Card
              title="Start with your document"
              subtitle="Upload a PDF and let’s find the best way to print it."
            >
              <div
                className={"dropzone " + (drag ? "dragging" : "")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  if (!busy) loadFile(e.dataTransfer.files[0]);
                }}
              >
                <span className="upload-icon">
                  <UploadCloud size={34} />
                </span>
                <h2>
                  {busy
                    ? "Analyzing your document…"
                    : "A great print starts with a file."}
                </h2>
                <p>Drag your PDF here, or choose a file to upload.</p>
                <button
                  className="button primary"
                  disabled={busy || !data}
                  onClick={() => input.current.click()}
                >
                  {busy ? (
                    <Busy text="Processing PDF" />
                  ) : (
                    <>
                      <Plus size={17} />
                      Browse files
                    </>
                  )}
                </button>
                <input
                  ref={input}
                  type="file"
                  accept=".pdf,application/pdf"
                  aria-label="Choose PDF"
                  hidden
                  onChange={(e) => loadFile(e.target.files[0])}
                />
                <small>PDF only · Up to 10 MB · Maximum 150 pages</small>
                {busy && (
                  <div className="upload-progress">
                    <progress max="100" value={progress} />
                    <span>{progress}%</span>
                  </div>
                )}
              </div>
              
              <div className="secure-note">
                <ShieldCheck size={16} />
                Your document is stored privately in your workspace.
              </div>
            </Card>
          )}
          {step === 1 && a && (
            <Card
              title="A closer look at your document"
              subtitle="Practical analysis. Better printing decisions."
            >
              <FileLabel
                name={doc.name}
                meta={`${(doc.size / 1024).toFixed(1)} KB · ${a.total_pages} pages`}
              />
              <div className="analysis-metrics">
                <div>
                  <strong>{a.total_pages}</strong>
                  <span>Total pages</span>
                </div>
                <div>
                  <strong>{a.blank_pages.length}</strong>
                  <span>Likely blank</span>
                </div>
                <div>
                  <strong>{a.color_pages.length}</strong>
                  <span>Likely color</span>
                </div>
                <div>
                  <strong>{a.bw_pages.length}</strong>
                  <span>Black & white</span>
                </div>
              </div>
              <div className="recommendation">
                <Sparkles size={23} />
                <div>
                  <h3>Make every sheet work a little harder.</h3>
                  <p>
                    {a.blank_pages.length
                      ? `Review blank page${a.blank_pages.length > 1 ? "s" : ""} ${a.blank_pages.join(", ")} before removing them. `
                      : "No blank pages detected. "}
                    Duplex printing can reduce your sheet count.
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      setSettings((s) => ({
                        ...s,
                        duplex: true,
                        mode: "auto",
                        remove_blank: a.blank_pages.length > 0,
                      }));
                      toast.success(
                        "Duplex and auto color selected. Blank-page removal is enabled when applicable.",
                      );
                    }}
                  >
                    <Leaf size={16} />
                    Apply recommendations
                  </button>
                </div>
              </div>
              <div className="analysis-pages">
                {a.pages.slice(0, 30).map((p) => (
                  <div
                    key={p.number}
                    title={`${p.width} × ${p.height} points · ${p.coverage}% content`}
                  >
                    <FileText
                      size={27}
                      className={p.blank ? "muted" : p.color ? "blue-text" : ""}
                    />
                    <span>Page {p.number}</span>
                    <small>
                      {p.blank ? "Blank" : p.color ? "Color" : "B&W"}
                    </small>
                  </div>
                ))}
              </div>
              {a.total_pages > 30 && (
                <p className="small muted">Showing the first 30 pages.</p>
              )}
              <div className="notice">
                <Sparkles size={17} />
                <p>
                  {a.engine}. Color and blank-page estimates are based on
                  rendered pixels, with no OCR. Check the original before
                  removing pages.
                </p>
              </div>
              <div className="wizard-actions">
                <button
                  className="button"
                  onClick={() => {
                    setStep(0);
                    setDoc(null);
                  }}
                >
                  <ArrowLeft size={16} />
                  Change document
                </button>
                <button className="button primary" onClick={() => setStep(2)}>
                  Configure print <ArrowRight size={16} />
                </button>
              </div>
            </Card>
          )}
          {step === 2 && a && (
            <Card
              title="Print it your way"
              subtitle="Fine-tune the details. We’ll keep the price up to date."
            >
              <div className="form-grid">
                <Field label="Copies">
                  <div className="step-input">
                    <button
                      onClick={() =>
                        update(
                          "copies",
                          Math.max(1, Number(settings.copies) - 1),
                        )
                      }
                      aria-label="Fewer copies"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.copies}
                      onChange={(e) => update("copies", e.target.value)}
                      aria-label="Number of copies"
                    />
                    <button
                      onClick={() =>
                        update(
                          "copies",
                          Math.min(100, Number(settings.copies) + 1),
                        )
                      }
                      aria-label="More copies"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </Field>
                <Field label="Paper size">
                  <select
                    value={settings.paper}
                    onChange={(e) => update("paper", e.target.value)}
                  >
                    <option>A4</option>
                    <option>A3</option>
                  </select>
                </Field>
                <Field label="Color mode">
                  <select
                    value={settings.mode}
                    onChange={(e) => update("mode", e.target.value)}
                  >
                    <option value="auto">Auto · color where needed</option>
                    <option value="bw">Black & white</option>
                    <option value="color">Full color</option>
                  </select>
                </Field>
             {/* pages per side removed form here */}
                <Field
                  label="Page range"
                  hint={`Leave empty for all ${a.total_pages} pages.`}
                >
                  <input
                    value={settings.range}
                    onChange={(e) => update("range", e.target.value)}
                    placeholder="All pages, or 1–4, 7, 9–12"
                  />
                </Field>
                <Field label="Orientation">
                  <select
                    value={settings.orientation}
                    onChange={(e) => update("orientation", e.target.value)}
                  >
                    <option value="auto">Automatic</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </Field>
              </div>
              <Toggle
                label="Double-sided printing"
                description="Use both sides of each sheet."
                checked={settings.duplex}
                onChange={(v) => update("duplex", v)}
              />
              <Toggle
                label="Remove likely blank pages"
                description={
                  a.blank_pages.length
                    ? `Detected on page${a.blank_pages.length > 1 ? "s" : ""} ${a.blank_pages.join(", ")}.`
                    : "No blank pages found in this document."
                }
                checked={settings.remove_blank}
                onChange={(v) => update("remove_blank", v)}
              />
              <Field label="Choose a printer">
                <select
                  value={printer}
                  onChange={(e) => setPrinter(e.target.value)}
                >
                  <option value="">
                    Smart assignment · shortest compatible queue
                  </option>
                  {data?.printers.map((p) => (
                    <option
                      disabled={
                        !p.enabled ||
                        (settings.paper === "A3" && !p.a3) ||
                        (!!quote?.color_pages && !p.color)
                      }
                      key={p.id}
                      value={p.id}
                    >
                      {p.name} · {p.location} {!p.enabled ? "(Offline)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {quoteError && <ErrorNotice error={quoteError} />}
              <div className="wizard-actions">
                <button className="button" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  className="button primary"
                  disabled={!quote || !!quoteError}
                  onClick={() => setStep(3)}
                >
                  Review order <ArrowRight size={16} />
                </button>
              </div>
            </Card>
          )}
          {step === 3 && quote && (
            <Card
              title="Looks good on paper."
              subtitle="One last look before your test payment."
            >
              <FileLabel
                name={doc.name}
                meta={`${doc.analysis.total_pages} pages in original · ${(doc.size / 1024).toFixed(1)} KB`}
              />
              <dl className="review-list">
                {[
                  ["Pages selected", quote.pages],
                  ["Copies", settings.copies],
                  ["Paper", settings.paper],
                  ["Color mode", humanMode(settings.mode)],
                  [
                    "Print sides",
                    settings.duplex ? "Double-sided" : "Single-sided",
                  ],

                  ["Page range", settings.range || "All pages"],
                  ["Orientation", settings.orientation],
                  [
                    "Blank-page removal",
                    settings.remove_blank ? "Enabled" : "Off",
                  ],
                  [
                    "Printer",
                    printer
                      ? data.printers.find((p) => p.id === printer)?.name
                      : "Smart assignment",
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="paper-comparison">
                <div>
                  <small>Without optimization</small>
                  <b>{quote.original_sheets} sheets</b>
                </div>
                <ArrowRight size={22} />
                <div>
                  <small>Your configuration</small>
                  <b>{quote.sheets} sheets</b>
                </div>
                <span>
                  <Leaf size={18} />
                  {quote.saved_sheets} saved
                </span>
              </div>
              <div className="wizard-actions">
                <button className="button" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} />
                  Edit settings
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={order}
                >
                  {busy ? (
                    <Busy />
                  ) : (
                    <>
                      Continue to payment <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </Card>
          )}
          {step === 4 && job && (
            <Card
              title="One last step to the print queue."
              subtitle="Choose a test payment method. No real money is collected."
            >
              <div className="payment-total">
                <small>Order {job.id}</small>
                <strong>{money(job.amount)}</strong>
                <span>
                  {payFailed
                    ? "Test payment failed · ready to retry"
                    : "Awaiting test payment"}
                </span>
              </div>
              <div className="payment-methods">
                {[
                  [Smartphone, "UPI"],
                  [QrCode, "QR code"],
  
                ].map(([Icon, n]) => (
                  <button
                    key={n}
                    className={method === n ? "selected" : ""}
                    onClick={() => setMethod(n)}
                  >
                    <Icon size={23} />
                    {n}
                    {method === n && <Check size={14} />}
                  </button>
                ))}
              </div>
              <div className="test-payment-info">
                <ShieldCheck size={22} />
                <div>
                  <h3>{method} test payment</h3>
                  <p>
                    This demo simulates payment verification on the server. No
                    UPI ID or banking app is needed.
                  </p>
                </div>
              </div>
              <button
                className="button primary full-width"
                disabled={busy}
                onClick={() => pay("success")}
              >
                {busy ? (
                  <Busy text="Verifying payment…" />
                ) : (
                  <>
                    Pay {money(job.amount)} in test mode{" "}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
              <button
                className="text-button test-fail"
                disabled={busy}
                onClick={() => pay("failed")}
              >
                Simulate a failed payment
              </button>
              <div className="secure-note">
                <ShieldCheck size={16} />
                Only verified orders enter the print queue.
              </div>
            </Card>
          )}
        </div>
        <aside className="wizard-aside">
          {doc ? (
            <>
              <Card title="Document preview">
                <FileLabel
                  name={doc.name}
                  meta={`${doc.analysis.total_pages} pages`}
                />
                <iframe
                  title="Original PDF preview"
                  src={"/api/documents/" + doc.id + "/file#toolbar=0"}
                  className="pdf-preview"
                />
                <a
                  className="text-link"
                  href={"/api/documents/" + doc.id + "/file"}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye size={16} />
                  Open original PDF
                </a>
              </Card>
              {quote && (
                <Card title="Your print estimate">
                  <div className="estimate-price">
                    {money(quote.amount)}
                    <small>Test payment · no real charge</small>
                  </div>
                  <dl className="review-list compact">
                    <div>
                      <dt>Selected pages</dt>
                      <dd>{quote.pages}</dd>
                    </div>
                    <div>
                      <dt>Printed sides</dt>
                      <dd>{quote.impressions}</dd>
                    </div>
                    <div>
                      <dt>Sheets needed</dt>
                      <dd>{quote.sheets}</dd>
                    </div>
                  </dl>
                  <div className="saving-note">
                    <Leaf size={17} />
                    {quote.saved_sheets} fewer sheets with this setup
                  </div>
                  <p className="small muted price-note">
                    Rates apply to printed sides. Paired B&W sides use the
                    duplex sheet rate. An unpaired side uses the single-side
                    rate.
                  </p>
                </Card>
              )}
            </>
          ) : (
            <Card title="Every page has potential.">
              <div className="why-row">
                <Sparkles />
                <div>
                  <h4>Understand your document</h4>
                  <p>Detect pages, likely blank pages, and color content.</p>
                </div>
              </div>
              <div className="why-row">
                <Leaf />
                <div>
                  <h4>Print with a little less</h4>
                  <p>Choose duplex or multiple pages per side to save paper.</p>
                </div>
              </div>
              <div className="why-row">
                <Printer />
                <div>
                  <h4>Know where your print is</h4>
                  <p>Follow your job from the smart queue to completion.</p>
                </div>
              </div>
              <span className="demo-explainer">
                You’re in demo mode. Payments and printers are simulated; PDF
                analysis and price calculations are real.
              </span>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
