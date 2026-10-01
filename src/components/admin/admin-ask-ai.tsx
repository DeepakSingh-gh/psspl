"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminPage } from "./admin-shell";
import { adminApi } from "@/lib/api";

const QUESTIONS = [
  "Which products sold the least?",
  "Which product gets attention in each region?",
  "Who are the top salespeople?",
  "What is the total outstanding?",
  "How many repeat customers do we have?",
  "How is field activity progressing?",
];

const SparkIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.4 9.3 5 12.9 6.3 9.3 7.6 8 11.2 6.7 7.6 3.1 6.3 6.7 5Z" />
    <path d="M12.7 9.6 13.3 11.3 15 11.9 13.3 12.5 12.7 14.2 12.1 12.5 10.4 11.9 12.1 11.3Z" opacity=".6" />
  </svg>
);

/** Question box, date range, suggestions and the answer — shared by the modal and the page. */
function AskAiContent({ autoFocus = false }: { autoFocus?: boolean }) {
  const defaults = useMemo(() => {
    const to = new Date().toISOString().slice(0, 10);
    return { from: `${to.slice(0, 4)}-04-01`, to };
  }, []);
  const [question, setQuestion] = useState("");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [result, setResult] = useState<{ answer: string; source: string; from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    try { setResult(await adminApi.askAi(question, from, to)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to answer the question"); }
    finally { setLoading(false); }
  }

  return (
    <div className="askai-body">
      <form className="askai-search" onSubmit={ask}>
        <span className="askai-field">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="7.2" cy="7.2" r="4.4" /><path d="m10.6 10.6 2.7 2.7" />
          </svg>
          <input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask anything about sales, customers or field activity…"
            aria-label="Your question"
          />
        </span>
        <button type="submit" className="askai-ask" disabled={loading || !question.trim()}>
          {loading ? "Checking…" : "Ask"}
        </button>
      </form>

      <div className="askai-range">
        <label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>

      <p className="askai-label">Suggested questions</p>
      <div className="askai-chips">
        {QUESTIONS.map((item) => (
          <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>
        ))}
      </div>

      {error && <p className="askai-error" role="alert">{error}</p>}

      {result && (
        <div className="askai-answer">
          <p className="askai-answer-label">Answer</p>
          <strong>{result.answer}</strong>
          <small>{result.source} · {result.from} to {result.to}</small>
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

/** Dashboard entry point: a button that opens the question box in a centred modal. */
export function AskAiLauncher() {
  const [open, setOpen] = useState(false);

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

      {open && (
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
        </div>
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
