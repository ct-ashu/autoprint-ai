import React from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  Sparkles,
  SlidersHorizontal,
  IndianRupee,
  Layers,
  Printer,
  ArrowRight,
  ArrowUpRight,
  Leaf,
  ShieldCheck,
  GraduationCap,
  Building2,
  BookOpen,
  Briefcase,
} from "lucide-react";
import { Brand } from "../components/Layout";
export default function Home() {
  return (
    <div className="landing">
      <header>
        <Brand />
        <nav>
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#resources">Resource optimization</a>
          <Link to="/">Dashboard</Link>
        </nav>
        <Link className="button primary" to="/new">
          Start printing <ArrowUpRight size={16} />
        </Link>
      </header>
      <section className="landing-hero">
        <span className="landing-kicker">
          <span /> INTELLIGENT PRINTING, REIMAGINED
        </span>
        <h1>
          Smart printing.
          <br />
          Less waste.
          <br />
          <em>Fully automated.</em>
        </h1>
        <p>
          AI-powered document analysis, intelligent resource optimization, and
          automated printing through a Raspberry Pi controller.
        </p>
        <div className="hero-buttons">
          <Link className="button primary" to="/new">
            Start printing <ArrowRight size={18} />
          </Link>
          <Link className="button" to="/">
            Explore dashboard <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="landing-proof">
          <ShieldCheck size={17} />
          Try the complete experience in demo mode. No payment needed.
        </div>
        <div className="landing-workflow" id="how-it-works">
          {[
            [UploadCloud, "01", "Upload"],
            [Sparkles, "02", "Analyze"],
            [SlidersHorizontal, "03", "Optimize"],
            [IndianRupee, "04", "Pay"],
            [Layers, "05", "Queue"],
            [Printer, "06", "Print"],
          ].map(([Icon, n, t]) => (
            <div key={n}>
              <small>{n}</small>
              <Icon size={25} />
              <b>{t}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="landing-features" id="features">
        <div>
          <span className="eyebrow">MADE FOR THE WAY YOU PRINT</span>
          <h2>
            More thought behind
            <br />
            every printed page.
          </h2>
          <p>
            AI that understands the document, optimizes the resources, and
            automates the print.
          </p>
        </div>
        <div className="landing-feature-grid">
          {[
            [
              Sparkles,
              "Document intelligence",
              "Check page count, likely blank pages, and color content with practical, rule-based analysis.",
            ],
            [
              Leaf,
              "Resource optimization",
              "Duplex, blank-page removal, and multiple pages per side help reduce paper use.",
            ],
            [
              Printer,
              "Smart print controller",
              "An authorized queue connects your web workflow to a Raspberry Pi and CUPS. Try it with the simulator.",
            ],
            [
              Layers,
              "A clearer operational picture",
              "Track jobs, printer availability, and paper savings in one connected workspace.",
            ],
          ].map(([Icon, t, p]) => (
            <article key={t}>
              <Icon size={24} />
              <h3>{t}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-resources" id="resources">
        <Leaf size={35} />
        <h2>
          A small change on screen.
          <br />A little less paper in the world.
        </h2>
        <p>
          See the estimated sheets you can save before you print. Choose what
          works for your document.
        </p>
        <Link className="button primary" to="/new">
          Make your next print smarter <ArrowRight size={18} />
        </Link>
      </section>
      <section className="use-cases">
        <h2>For wherever work happens.</h2>
        <div>
          {[
            [GraduationCap, "Students & colleges"],
            [BookOpen, "Libraries"],
            [Briefcase, "Offices"],
            [Building2, "Print shops & institutions"],
          ].map(([Icon, t]) => (
            <span key={t}>
              <Icon />
              {t}
            </span>
          ))}
        </div>
      </section>
      <footer>
        <Brand />
        <span>SIH 2026 · Smart Automation · Hardware</span>
        <Link to="/">
          Open workspace <ArrowUpRight size={16} />
        </Link>
      </footer>
    </div>
  );
}
