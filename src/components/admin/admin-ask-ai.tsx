"use client";
import { reportDateRange } from "@/lib/business-date";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AdminPage } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { AiResponseFormatter } from "../ai-response-formatter";

const QUESTIONS = [
  { icon: "📉", text: "Which products sold the least?" },
  { icon: "🌍", text: "Which product gets attention in each region?" },
  { icon: "🏆", text: "Who are the top salespeople & RMs?" },
  { icon: "💳", text: "What is the total outstanding?" },
  { icon: "🔄", text: "How many repeat customers do we have?" },
  { icon: "🚶", text: "How is field activity progressing?" },
  { icon: "⚠️", text: "Which dealers are dormant without orders?" },
];

const SparkIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.4 9.3 5 12.9 6.3 9.3 7.6 8 11.2 6.7 7.6 3.1 6.3 6.7 5Z" />
    <path d="M12.7 9.6 13.3 11.3 15 11.9 13.3 12.5 12.7 14.2 12.1 12.5 10.4 11.9 12.1 11.3Z" opacity=".6" />
  </svg>
);

/** Question box, date range, suggestions and the answer — shared by the modal and the page. */
function AskAiContent({ autoFocus = false, initialQuestion = "" }: { autoFocus?: boolean; initialQuestion?: string }) {
  const defaults = useMemo(() => reportDateRange("fy"), []);
  const [question, setQuestion] = useState(initialQuestion);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [result, setResult] = useState<{ answer: string; source: string; from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion);
      setLoading(true);
      setError("");
      setResult(null);
      adminApi.askAi(initialQuestion, defaults.from, defaults.to)
        .then((res) => setResult(res))
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to answer the question"))
        .finally(() => setLoading(false));
    }
  }, [initialQuestion, defaults.from, defaults.to]);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  async function runQuery(qToUse?: string) {
    const q = (qToUse ?? question).trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setResult(null);
    try { setResult(await adminApi.askAi(q, from, to)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to answer the question"); }
    finally { setLoading(false); }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    await runQuery();
  }

  function handleChipClick(q: string) {
    setQuestion(q);
    runQuery(q);
  }

  return (
    <div className="askai-body">
      <form className="askai-search" onSubmit={ask}>
        <div className="askai-field">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="askai-search-icon">
            <circle cx="7.2" cy="7.2" r="4.4" /><path d="m10.6 10.6 2.7 2.7" />
          </svg>
          <input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask anything about sales, customers or field activity…"
            aria-label="Your question"
          />
          {question && (
            <button
              type="button"
              className="askai-clear-btn"
              onClick={() => { setQuestion(""); inputRef.current?.focus(); }}
              aria-label="Clear question"
            >
              ✕
            </button>
          )}
          <button type="submit" className="askai-submit-btn" disabled={loading || !question.trim()}>
            <SparkIcon />
            <span>{loading ? "Searching…" : "Search"}</span>
          </button>
        </div>
      </form>

      <div className="askai-range-bar">
        <div className="askai-range">
          <label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <div className="askai-presets">
          <button type="button" onClick={() => { const next = reportDateRange("fy"); setFrom(next.from); setTo(next.to); }}>FY {defaults.from.slice(0, 4)}-{String(Number(defaults.from.slice(0, 4)) + 1).slice(-2)}</button>
          <button type="button" onClick={() => {
            const d = new Date(); d.setDate(d.getDate() - 30);
            setFrom(d.toISOString().slice(0, 10)); setTo(defaults.to);
          }}>Last 30 Days</button>
          <button type="button" onClick={() => { setFrom("2024-04-01"); setTo(defaults.to); }}>All Data</button>
        </div>
      </div>

      <p className="askai-label">Suggested questions</p>
      <div className="askai-chips">
        {QUESTIONS.map((item) => (
          <button type="button" key={item.text} onClick={() => handleChipClick(item.text)}>
            <span className="askai-chip-icon">{item.icon}</span>
            <span>{item.text}</span>
          </button>
        ))}
      </div>

      {error && <p className="askai-error" role="alert">{error}</p>}

      {loading && (
        <div className="askai-loading">
          <div className="askai-spinner"></div>
          <span>Fetching live intelligence from database...</span>
        </div>
      )}

      {result && !loading && (
        <div className="askai-answer-box">
          <AiResponseFormatter
            text={result.answer}
            source={result.source}
            from={result.from}
            to={result.to}
          />
        </div>
      )}

      {!result && !error && (
        <p className="askai-how">
          <b>How it works:</b> answers are built only from your synced Tally records and CRM activity for the dates above — nothing is invented.
        </p>
      )}
    </div>
  );
}

/** Header entry point: Fixed topbar AI Ask search bar & portal modal. */
export function HeaderAiAsk() {
  const [open, setOpen] = useState(false);
  const [initialQuestion, setInitialQuestion] = useState("");
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setOpen(true);
      return;
    }
    setInitialQuestion(query.trim());
    setOpen(true);
  }

  return (
    <>
      <div className="topbar-ai-search" onClick={() => setOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(true); }} aria-label="Open Ask AI command palette">
        <div className="topbar-ai-icon">
          <SparkIcon />
        </div>
        <span className="topbar-ai-placeholder">Ask AI anything...</span>
        <div className="topbar-ai-actions">
          <span className="topbar-ai-kbd">Ctrl K</span>
          <span className="topbar-ai-btn">
            <SparkIcon />
            <span>Ask AI</span>
          </span>
        </div>
      </div>

      {open && mounted && createPortal(
        <div className="askai-overlay" role="dialog" aria-modal="true" aria-label="Ask AI">
          <button type="button" className="askai-scrim" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="askai-modal">
            <header className="askai-head">
              <span className="askai-title"><SparkIcon />Ask AI · CRM Intelligence</span>
              <span className="askai-badge">Live Tally Data</span>
              <button type="button" className="askai-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <AskAiContent autoFocus initialQuestion={initialQuestion} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/** Dashboard entry point: a button that opens the question box in a portal modal. */
export function AskAiLauncher() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" className="ask-ai-launch" onClick={() => setOpen(true)}>
        <SparkIcon />
        <span>Ask AI</span>
        <em>AI</em>
      </button>

      {open && mounted && createPortal(
        <div className="askai-overlay" role="dialog" aria-modal="true" aria-label="Ask AI">
          <button type="button" className="askai-scrim" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="askai-modal">
            <header className="askai-head">
              <span className="askai-title"><SparkIcon />Ask AI · CRM intelligence</span>
              <span className="askai-badge">Live data</span>
              <button type="button" className="askai-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <AskAiContent autoFocus />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function AdminAskAi() {
  return (
    <AdminPage eyebrow="Ask AI" title="Ask your CRM" description="Ask management questions in everyday language. Answers use only your synced Tally records and CRM activity.">
      <section className="admin-card askai-page">
        <AskAiContent />
      </section>
    </AdminPage>
  );
}


