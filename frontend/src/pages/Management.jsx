import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Printer,
  Plus,
  Power,
  Activity,
  MapPin,
  Wifi,
  Usb,
  ArrowRight,
  Leaf,
  Sparkles,
  FileStack,
  Clock,
  IndianRupee,
  ShieldCheck,
  Save,
  Users,
  CheckCircle2,
  BarChart3,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  Heading,
  Card,
  Metric,
  Badge,
  Loading,
  Field,
  Toggle,
  Modal,
  BarChart,
  ErrorNotice,
  Empty,
} from "../components/UI";
import { api, number, money } from "../services/api";
export function Printers() {
  const { data, error, refresh } = useWorkspace(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({ name: "", model: "", location: "" });
  if (!data)
    return error ? (
      <ErrorNotice error={error} onRetry={refresh} />
    ) : (
      <Loading />
    );
  async function action(p, a) {
    try {
      await api(`/printers/${p.id}/${a}`, {});
      await refresh();
      toast.success(
        a === "test"
          ? "Simulated printer check passed. No physical page was sent."
          : "Printer availability updated.",
      );
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/printers/register", form);
      await refresh();
      setOpen(false);
      setForm({ name: "", model: "", location: "" });
      toast.success("Printer added to the simulator.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Printer management"
        eyebrow="YOUR CONNECTED PRINT NETWORK"
        subtitle="Keep every printer ready for what’s next."
      >
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={17} />
          Add printer
        </button>
      </Heading>
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          Simulation mode is active. Printer checks and availability reflect the
          simulator. Paper-level telemetry requires compatible hardware.
        </span>
      </div>
      <div className="printer-grid">
        {data.printers.map((p) => (
          <Card key={p.id}>
            <div className="printer-card-top">
              <span className="device-icon">
                <Printer size={30} />
              </span>
              <Badge status={p.status} />
            </div>
            <h2>{p.name}</h2>
            <p className="printer-model">{p.model}</p>
            <div className="printer-details">
              <span>
                <MapPin size={16} />
                {p.location}
              </span>
              <span>
                {p.connection === "USB" ? (
                  <Usb size={16} />
                ) : (
                  <Wifi size={16} />
                )}{" "}
                {p.connection} connection · {p.id}
              </span>
            </div>
            <div className="printer-stats">
              <div>
                <strong>{p.queue_length}</strong>
                <small>In queue</small>
              </div>
              <div>
                <strong>{p.color ? "Color" : "B&W"}</strong>
                <small>Print capability</small>
              </div>
              <div>
                <strong>{p.a3 ? "A3 + A4" : "A4"}</strong>
                <small>Paper</small>
              </div>
            </div>
            <div className="utilization">
              <span>
                Simulated utilization <b>{p.utilization}%</b>
              </span>
              <progress max="100" value={p.utilization} />
            </div>
            <small className="muted">
              Paper level: not reported by simulator
            </small>
            <div className="printer-actions">
              <button className="button" onClick={() => action(p, "test")}>
                <Activity size={15} />
                Test
              </button>
              <button
                className={"button " + (!p.enabled ? "primary" : "")}
                onClick={() => action(p, "toggle")}
              >
                <Power size={15} />
                {p.enabled ? "Disable" : "Enable"}
              </button>
              <Link className="button" to={"/queue?printer=" + p.id}>
                Queue <ArrowRight size={15} />
              </Link>
            </div>
            <Link className="text-link" to={"/jobs?printer=" + p.id}>
              View printer history <ArrowRight size={14} />
            </Link>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a printer">
        <form onSubmit={add}>
          <p className="modal-copy">
            Add a simulated A4 color printer to your workspace.
          </p>
          {[
            ["name", "Printer name"],
            ["model", "Model"],
            ["location", "Location"],
          ].map(([k, label]) => (
            <Field key={k} label={label}>
              <input
                required
                maxLength="60"
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </Field>
          ))}
          <div className="modal-actions">
            <button
              type="button"
              className="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              Add printer
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
export function Analytics() {
  const { data, refresh } = useWorkspace();
  const [period, setPeriod] = useState("7"),
    [source, setSource] = useState("all"),
    [start, setStart] = useState(
      new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
    ),
    [end, setEnd] = useState(new Date().toISOString().slice(0, 10)),
    [stats, setStats] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api(
      `/analytics/resources?days=${period === "custom" ? 7 : period}&source=${source}` +
        (period === "custom" ? `&start=${start}&end=${end}` : ""),
    )
      .then((d) => {
        if (live) {
          setStats(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [period, source, start, end, data?.jobs.length, data?.stats.completed]);
  const s = stats;
  return (
    <>
      <Heading
        title="Usage & analytics"
        eyebrow="SMALL CHOICES. MEASURABLE IMPACT."
        subtitle="See what you print. Understand what you save."
      >
        <select
          aria-label="Analytics period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="1">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="custom">Custom dates</option>
        </select>
        <select
          aria-label="Analytics data source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="all">All records</option>
          <option value="new">Your uploads only</option>
          <option value="sample">Sample data only</option>
        </select>
      </Heading>
      {period === "custom" && (
        <div className="date-range">
          <Field label="From">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
      )}
      {error && <ErrorNotice error={error} />}{" "}
      {!s ? (
        <Loading />
      ) : (
        <>
          <div className="data-caption">
            {s.start} – {s.end} · {s.new_jobs} jobs from your uploads ·{" "}
            {s.sample_jobs} sample records · UTC
          </div>
          <div className="metrics">
            <Metric
              icon={FileStack}
              label="Pages printed"
              value={number(s.pages)}
              detail={`${s.completed} completed jobs`}
            />
            <Metric
              icon={Leaf}
              label="Sheets saved"
              value={number(s.saved)}
              detail="Compared with one page per sheet"
              tone="green"
            />
            <Metric
              icon={Clock}
              label="Average queue wait"
              value={s.avg_wait + " min"}
              detail="Completed jobs in this period"
              tone="cyan"
            />
            <Metric
              icon={IndianRupee}
              label="Test revenue"
              value={money(s.revenue)}
              detail="Simulated payments only"
              tone="orange"
            />
          </div>
          <div className="analytics-grid">
            <Card title="Pages printed" subtitle="Completed pages over time">
              <BarChart data={s.activity} value="pages" />
            </Card>
            <Card
              title="Paper consumption"
              subtitle="Physical sheets used after optimization"
            >
              <BarChart data={s.activity} value="sheets" color="#24a6b5" />
            </Card>
            <Card
              title="Print color"
              subtitle="The balance of black & white and color"
            >
              <div className="composition">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(#2878d4 0 ${s.pages ? (s.bw / s.pages) * 100 : 0}%,#f0b45e 0 100%)`,
                  }}
                >
                  <div>
                    <strong>{number(s.pages)}</strong>
                    <small>pages printed</small>
                  </div>
                </div>
                <div>
                  <span>
                    <i className="blue-dot" />
                    Black & white <b>{number(s.bw)}</b>
                  </span>
                  <span>
                    <i className="orange-dot" />
                    Color <b>{number(s.color)}</b>
                  </span>
                </div>
              </div>
            </Card>
            <Card
              title="Single-sided vs. duplex"
              subtitle="Completed jobs by print setting"
            >
              <div className="side-comparison">
                <div>
                  <span>Double-sided</span>
                  <b>{s.duplex} jobs</b>
                  <progress max={s.duplex + s.single || 1} value={s.duplex} />
                </div>
                <div>
                  <span>Single-sided</span>
                  <b>{s.single} jobs</b>
                  <progress max={s.duplex + s.single || 1} value={s.single} />
                </div>
                <p className="saving-note">
                  <Leaf size={18} />
                  Duplex adoption:{" "}
                  {Math.round((s.duplex / (s.duplex + s.single || 1)) * 100)}%
                </p>
              </div>
            </Card>
            <Card title="Printer workload" subtitle="Completed pages by device">
              <BarChart
                data={s.utilization.map((p) => ({ ...p, label: p.name }))}
                value="pages"
                color="#24a6b5"
              />
            </Card>
            <Card title="Peak demand" subtitle="Jobs created by hour · UTC">
              <BarChart
                data={s.peak.map((p) => ({ ...p, label: p.hour + ":00" }))}
                height={178}
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
export function Insights() {
  const { data, error, refresh } = useWorkspace();
  if (!data)
    return error ? (
      <ErrorNotice error={error} onRetry={refresh} />
    ) : (
      <Loading />
    );
  return (
    <>
      <Heading
        title="AI resource insights"
        eyebrow="BETTER DECISIONS, ONE PAGE AT A TIME"
        subtitle="Practical observations from your actual workspace activity."
      />
      <div className="insights-banner">
        <Sparkles size={32} />
        <div>
          <h2>Good data. Thoughtful recommendations.</h2>
          <p>
            Rule-based insights from the last 7 days, including labeled sample
            records. No predictive AI claims.
          </p>
        </div>
      </div>
      <div className="insights-full-grid">
        {data.insights.map((x, i) => (
          <Card key={i}>
            <span className={"icon-box " + x.type}>
              {x.type === "green" ? <Leaf size={24} /> : <Sparkles size={24} />}
            </span>
            <h2>{x.title}</h2>
            <p>{x.text}</p>
            <Link className="text-link" to={x.to}>
              {x.action}
              <ArrowRight size={16} />
            </Link>
          </Card>
        ))}
      </div>
      <Card title="Want insights for a particular document?">
        <div className="inline-callout">
          <p>
            Upload a PDF to check its page count, likely blank pages, and color
            content.
          </p>
          <Link className="button primary" to="/new">
            Analyze a document <ArrowRight size={16} />
          </Link>
        </div>
      </Card>
    </>
  );
}
export function Pricing() {
  const { data, refresh } = useWorkspace(),
    [form, setForm] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !form) setForm(data.pricing);
  }, [data]);
  if (!form) return <Loading />;
  const labels = {
    a4_bw: "A4 · B&W single side",
    a4_duplex: "A4 · B&W duplex sheet",
    a4_color: "A4 · Color side",
    a3_bw: "A3 · B&W single side",
    a3_duplex: "A3 · B&W duplex sheet",
    a3_color: "A3 · Color side",
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/pricing", form);
      await refresh();
      toast.success("Rates saved. New orders use these prices.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Print pricing"
        eyebrow="CLEAR PRICES. NO SURPRISES."
        subtitle="Manage the rates used by the server-side pricing engine."
      />
      <form onSubmit={save}>
        <Card
          title="Rates in Indian rupees"
          subtitle="Existing orders keep their original price."
        >
          <div className="form-grid">
            {Object.keys(labels).map((k) => (
              <Field label={labels[k]} key={k}>
                <div className="currency-input">
                  <span>₹</span>
                  <input
                    required
                    type="number"
                    min="0.01"
                    max="1000"
                    step="0.01"
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              </Field>
            ))}
          </div>
          <div className="notice">
            <IndianRupee size={20} />
            <p>
              Color is priced per imposed printed side. A pair of B&W sides uses
              the duplex sheet rate; an unpaired B&W side uses the single-side
              rate. Multiple pages per side are combined before pricing.
            </p>
          </div>
          <button className="button primary" disabled={busy}>
            <Save size={17} />
            Save pricing
          </button>
        </Card>
      </form>
    </>
  );
}
export function Settings({ admin = false }) {
  const { data, refresh } = useWorkspace(),
    [form, setForm] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !form) setForm(data.profile);
  }, [data]);
  if (!form) return <Loading />;
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/settings", form);
      await refresh();
      toast.success("Your preferences are saved.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={admin ? "System settings" : "Settings"}
        eyebrow="MAKE IT YOUR WORKSPACE"
        subtitle="A few defaults to make every print a little easier."
      />
      <div className="settings-grid">
        <form onSubmit={save}>
          <Card title="Your profile">
            <div className="form-grid">
              <Field label="Display name">
                <input
                  required
                  maxLength="60"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Email (optional)">
                <input
                  type="email"
                  maxLength="120"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
            <h3 className="settings-subheading">Printing preferences</h3>
            <Toggle
              label="Use duplex by default"
              description="Start new jobs with double-sided printing enabled."
              checked={form.default_duplex}
              onChange={(v) => setForm({ ...form, default_duplex: v })}
            />
            <Toggle
              label="Show print notifications"
              description="Display the active-job indicator in your workspace."
              checked={form.notify}
              onChange={(v) => setForm({ ...form, notify: v })}
            />
            <button className="button primary" disabled={busy}>
              <Save size={17} />
              Save changes
            </button>
          </Card>
        </form>
        <Card title="Workspace status">
          <dl className="review-list">
            <div>
              <dt>Environment</dt>
              <dd>
                <Badge status="Demo" />
              </dd>
            </div>
            <div>
              <dt>Payments</dt>
              <dd>Test mode</dd>
            </div>
            <div>
              <dt>Printer controller</dt>
              <dd>Simulation</dd>
            </div>
            <div>
              <dt>Document limit</dt>
              <dd>10 MB / 150 pages</dd>
            </div>
            <div>
              <dt>Analysis</dt>
              <dd>Rule-based</dd>
            </div>
          </dl>
          <div className="notice">
            <ShieldCheck size={19} />
            <p>
              No real money is collected, and no physical printer is connected.
            </p>
          </div>
          {admin && (
            <div className="small muted workspace-id">
              Controller workspace ID: <code>{form.workspace}</code>
              <p>Used by the local Raspberry Pi agent configuration.</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
export function UsersPage() {
  const { data } = useWorkspace();
  if (!data) return <Loading />;
  return (
    <>
      <Heading
        title="Workspace users"
        eyebrow="CAMPUS WORKSPACE"
        subtitle="Your private demo session has one workspace profile."
      />
      <Card title="Members">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>NAME</th>
                <th>EMAIL</th>
                <th>ACCESS</th>
                <th>JOBS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{data.profile.name}</td>
                <td>{data.profile.email || "Not provided"}</td>
                <td>
                  <Badge status="Demo administrator" />
                </td>
                <td>{data.jobs.filter((j) => !j.seed).length}</td>
                <td>
                  <Link className="text-link" to="/admin/settings">
                    Edit profile <ArrowRight size={15} />
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="data-caption">
          Sample jobs are example activity, not additional registered users.
        </p>
      </Card>
    </>
  );
}
