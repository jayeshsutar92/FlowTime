import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredAuth } from "../authStorage";

function Home() {
  const auth = getStoredAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const startPath = auth?.token ? "/select" : "/auth";
  const landingClassName = isDarkMode ? "landing-page dark-theme" : "landing-page";
  const featureBlocks = useMemo(
    () => [
      {
        title: "Focus Sessions",
        copy: "Run structured work cycles that help you stay on one task without overthinking the process.",
      },
      {
        title: "Analytics",
        copy: "Review your consistency, completed sessions, and patterns without leaving the flow.",
      },
      {
        title: "Presets",
        copy: "Save quick configurations so your preferred timing setup is always ready to start.",
      },
      {
        title: "Simple Flow",
        copy: "Move from starting a session to reviewing progress with a clean, distraction-free setup.",
      },
    ],
    []
  );
  const faqs = useMemo(
    () => [
      {
        question: "How does FlowTime help me stay consistent?",
        answer: "It keeps the flow simple: choose a timer, start a session, and review progress without extra clutter.",
      },
      {
        question: "Can I use preset session lengths?",
        answer: "Yes. You can save and reuse presets so common work and break combinations are available quickly.",
      },
      {
        question: "Will my session analytics stay available later?",
        answer: "Your dashboard keeps session totals and progress insights so you can track momentum over time.",
      },
      {
        question: "Is the timer flexible for different work styles?",
        answer: "You can use the default flow or switch to custom settings when you need a different rhythm.",
      },
      {
        question: "Can I switch themes while using the landing page?",
        answer: "Yes. The landing page includes a light and dark presentation mode without affecting app functionality.",
      },
    ],
    []
  );

  return (
    <div className={landingClassName}>
      <section className="landing-hero">
        <div className="landing-topbar">
          <span className="landing-brand">FlowTime</span>
          <button
            type="button"
            className="landing-theme-toggle"
            onClick={() => setIsDarkMode((current) => !current)}
          >
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        <div className="landing-hero-card">
          <p className="landing-kicker">Focus better. Finish clearly.</p>
          <h1 className="landing-title">Turn minutes into real progress</h1>
          <p className="landing-subtitle">
            A clean productivity flow for focused sessions, progress tracking, and simple session planning.
          </p>
          <Link to={startPath} className="btn landing-primary-button">
            Start Yours
          </Link>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <p className="landing-section-label">Trusted by users</p>
          <h2 className="landing-section-title">Built for steady, everyday focus</h2>
        </div>
        <div className="landing-proof-row">
          <div className="landing-names">
            <span>Aarav Mehta</span>
            <span>Riya Sharma</span>
            <span>Karan Patel</span>
            <span>Neha Joshi</span>
          </div>
          <div className="landing-logo-row">
            <span>Northline</span>
            <span>CraftLab</span>
            <span>MetricCo</span>
            <span>Studio Grid</span>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <p className="landing-section-label">Features</p>
          <h2 className="landing-section-title">Everything you need without the noise</h2>
        </div>
        <div className="landing-features">
          {featureBlocks.map((feature, index) => (
            <article
              key={feature.title}
              className={`landing-feature-card ${index % 2 === 1 ? "landing-feature-offset" : ""}`}
            >
              <p className="landing-feature-index">0{index + 1}</p>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-dashboard-preview">
          <div className="landing-preview-copy">
            <p className="landing-section-label">Dashboard Preview</p>
            <h2 className="landing-section-title">Track your progress</h2>
            <p className="landing-body-copy">
              Review completed sessions, focus time, and momentum from one simple dashboard view.
            </p>
          </div>

          <div className="landing-preview-card">
            <div className="landing-preview-stat">
              <span>Total Focus Time</span>
              <strong>18h 40m</strong>
            </div>
            <div className="landing-preview-stat">
              <span>Completed Sessions</span>
              <strong>42</strong>
            </div>
            <div className="landing-preview-progress">
              <div>
                <span>Weekly Rhythm</span>
                <strong>High Consistency</strong>
              </div>
              <div className="landing-preview-bars" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <p className="landing-section-label">FAQ</p>
          <h2 className="landing-section-title">Questions people usually ask first</h2>
        </div>
        <div className="landing-faq-list">
          {faqs.map((item) => (
            <details key={item.question} className="landing-faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-card">
          <h2 className="landing-section-title">Ready to start?</h2>
          <p className="landing-body-copy">Begin a focused session or jump back into your workflow.</p>
          <Link to={startPath} className="btn landing-primary-button">
            Start Yours
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-links">
          <a href="/">About</a>
          <a href="/">Privacy</a>
          <a href="/">Support</a>
        </div>
        <p>Copyright 2026 FlowTime. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Home;
