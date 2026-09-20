import React, { useEffect, useRef } from "react";
import {
  X,
  FileText,
  ArrowUpRight,
  Inbox,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
export function Badge({ status }) {
  return (
    <span
      className={"badge status-" + status.toLowerCase().replaceAll(" ", "-")}
    >
      {["Online", "Printing", "Queued"].includes(status) && <i />}
      {status}
    </span>
  );
}
export function Heading({ eyebrow = "WORKSPACE", title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Card({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={"card " + className}>
      {title && (
        <div className="card-heading">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Metric({ icon: Icon, label, value, detail, tone = "blue" }) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <span className={"icon-box " + tone}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function Empty({ title = "Nothing here yet", text, action }) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Loading workspace">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
export function Busy({ text = "Working…" }) {
  return (
    <span className="busy">
      <LoaderCircle size={18} className="spin" />
      {text}
    </span>
  );
}
export function ErrorNotice({ error, onRetry }) {
  return (
    <div role="alert" className="notice error">
      <AlertCircle size={19} />
      <span>{error}</span>
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="modal"
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FileLabel({ name, meta }) {
  return (
    <div className="file-label">
      <span className="file-icon">
        <FileText size={19} />
      </span>
      <div>
        <strong>{name}</strong>
        {meta && <small>{meta}</small>}
      </div>
    </div>
  );
}
export function TextLink({ to, children }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="toggle-row">
      <span>
        <b>{label}</b>
        {description && <small>{description}</small>}
      </span>
      <input
        className="toggle"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function BarChart({
  data,
  value = "jobs",
  color = "#2878d4",
  height = 178,
}) {
  const max = Math.max(1, ...data.map((d) => d[value]));
  const ticks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];
  return (
    <div className="bar-chart" style={{ height: height + 32 }}>
      <div className="chart-y">
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="bar-chart-area">
        <div className="chart-grid">
          {ticks.map((_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="bars">
          {data.map((d, i) => (
            <div className="bar-column" key={d.date || i}>
              <div className="bar-track">
                <div
                  tabIndex={0}
                  className="bar"
                  style={{
                    height: Math.max(2, (d[value] / max) * 100) + "%",
                    background: color,
                  }}
                  aria-label={`${d.date || d.label}: ${d[value]}`}
                >
                  <span className="chart-tooltip">
                    {d.date || d.label}: {d[value]}
                  </span>
                </div>
              </div>
              <span>
                {data.length > 14 ? (i % 5 === 0 ? d.label : "") : d.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
