import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ArrowRight,
  Sparkles,
  Leaf,
  Printer,
  Files,
  FileStack,
  FileText,
  Palette,
  ArrowUpRight,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  Heading,
  Metric,
  Card,
  BarChart,
  TextLink,
  Loading,
  ErrorNotice,
  Badge,
  FileLabel,
} from "../components/UI";
import { api, number, money, date, humanMode } from "../services/api";
export default function Dashboard({ admin = false }) {
  const { data, error, refresh } = useWorkspace();
  const [days, setDays] = useState("7"),
    [stats, setStats] = useState(null);
  useEffect(() => {
    if (data) {
      if (days === "7") setStats(data.stats);
      else
        api("/analytics/dashboard?days=" + days)
          .then(setStats)
          .catch(() => {});
    }
  }, [days, data]);
  if (!data)
    return error ? (
      <ErrorNotice error={error} onRetry={refresh} />
    ) : (
      <Loading />
    );
  const s = stats || data.stats;
  return (
    <>
      <Heading
        eyebrow={admin ? "CAMPUS OPERATIONS" : "YOUR PRINTING, AT A GLANCE"}
        title={admin ? "Admin overview" : "Dashboard"}
        subtitle={
          admin
            ? "A clear view of every printer, page, and print job."
            : "Less waiting. Smarter printing. Everything in one place."
        }
      >
        <Link className="button primary" to="/new">
          <Plus size={18} />
          New print job
        </Link>
      </Heading>
      {error && <ErrorNotice error={error} onRetry={refresh} />}
      {!admin && (
        <div className="welcome-banner">
          <div>
            <span className="banner-eyebrow">READY WHEN YOU ARE</span>
            <h2>Your next print starts here.</h2>
            <p>
              Upload a document. We’ll help you make the most of every page.
            </p>
            <Link className="button white" to="/new">
              Upload a document <ArrowRight size={17} />
            </Link>
          </div>
          <div className="banner-facts">
            <span>
              <Sparkles />
              Smart document analysis
            </span>
            <span>
              <Leaf />
              Less paper, same possibilities
            </span>
            <span>
              <Printer />
              Follow your print in real time
            </span>
          </div>
        </div>
      )}
      <div className="metrics">
        <Metric
          icon={Files}
          label="Today’s jobs"
          value={number(data.stats.today_jobs)}
          detail="Across your workspace"
        />
        <Metric
          icon={FileStack}
          label="Pages printed"
          value={number(s.pages)}
          detail={days === "1" ? "Today" : "In selected period"}
          tone="cyan"
        />
        <Metric
          icon={FileText}
          label="B&W pages"
          value={number(s.bw)}
          detail={`${s.pages ? Math.round((s.bw / s.pages) * 100) : 0}% of print volume`}
          tone="green"
        />
        <Metric
          icon={Palette}
          label="Color pages"
          value={number(s.color)}
          detail="A little color goes a long way"
          tone="orange"
        />
      </div>
      {admin && (
        <div className="admin-metrics">
          <span>
            <strong>{s.active}</strong>Active jobs
          </span>
          <span>
            <strong>{s.completed}</strong>Completed
          </span>
          <span>
            <strong>{s.failed}</strong>Failed
          </span>
          <span>
            <strong>{number(s.saved)}</strong>Sheets saved
          </span>
          <span>
            <strong>{money(s.revenue)}</strong>Test revenue
          </span>
        </div>
      )}
      <div className="dashboard-charts">
        <Card
          title="Print activity"
          subtitle="A clearer picture of your printing habits"
          action={
            <select
              aria-label="Print activity period"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="compact-select"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="1">Today</option>
            </select>
          }
        >
          <div className="chart-meta">
            <span>
              <i />
              Print jobs
            </span>
            <span>
              {number(s.jobs)} total jobs{" "}
              <span className="muted">· includes sample data</span>
            </span>
          </div>
          <BarChart data={s.activity} />
        </Card>
        <Card
          title="Printer availability"
          action={<TextLink to="/admin/printers">View all</TextLink>}
        >
          <div className="printer-list">
            {data.printers.slice(0, 3).map((p) => (
              <Link
                to={"/queue?printer=" + p.id}
                className="printer-line"
                key={p.id}
              >
                <span className="printer-icon">
                  <Printer size={20} />
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.location}</small>
                </div>
                <div className="printer-line-status">
                  <Badge status={p.status} />
                  <small>{p.queue_length} in queue</small>
                </div>
              </Link>
            ))}
          </div>
          <div className="availability-foot">
            <span className="live-dot" />
            {data.printers.filter((p) => p.enabled).length} printers available
            <span>Simulated</span>
          </div>
        </Card>
      </div>
      <Card
        title={admin ? "Recent orders" : "Recent print jobs"}
        subtitle="From upload to output, stay in the loop."
        action={
          <TextLink to={admin ? "/admin/orders" : "/jobs"}>
            View all jobs
          </TextLink>
        }
        className="recent-card"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DOCUMENT</th>
                <th>JOB ID</th>
                <th>TYPE</th>
                <th>PAGES</th>
                <th>STATUS</th>
                <th>CREATED</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.jobs.slice(0, 4).map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={"/jobs/" + j.id}>
                      <FileLabel
                        name={j.document_name}
                        meta={
                          j.seed
                            ? "Sample record"
                            : j.settings.paper +
                              " · " +
                              (j.settings.duplex
                                ? "Double-sided"
                                : "Single-sided")
                        }
                      />
                    </Link>
                  </td>
                  <td className="mono">{j.id}</td>
                  <td>
                    <span
                      className={
                        "type-label " +
                        (j.settings.mode === "color" ? "color" : "")
                      }
                    >
                      {j.settings.mode === "bw"
                        ? "B&W"
                        : j.settings.mode === "auto"
                          ? "Auto"
                          : "Color"}
                    </span>
                  </td>
                  <td>{j.quote.pages * j.settings.copies}</td>
                  <td>
                    <Badge status={j.status} />
                  </td>
                  <td className="muted">{date(j.created_at)}</td>
                  <td>
                    <Link
                      className="icon-button"
                      aria-label={"View " + j.id}
                      to={"/jobs/" + j.id}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="section-title">
        <h3>
          <Sparkles size={18} />A little intelligence. A little less waste.
        </h3>
        <TextLink to="/insights">All insights</TextLink>
      </div>
      <div className="insight-grid">
        {data.insights.slice(0, 3).map((x, i) => (
          <Link to={x.to} className={"insight-mini " + x.type} key={i}>
            <span className={"icon-box " + x.type}>
              {i === 0 ? (
                <Leaf size={20} />
              ) : i === 1 ? (
                <Printer size={20} />
              ) : (
                <Sparkles size={20} />
              )}
            </span>
            <div>
              <h4>{x.title}</h4>
              <p>
                {i === 0
                  ? "Your smarter choices are adding up."
                  : i === 1
                    ? "Find a shorter queue for your next job."
                    : "Print in color only where it matters."}
              </p>
            </div>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </div>
    </>
  );
}
