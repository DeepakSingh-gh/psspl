"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { salesFeaturesApi } from "@/lib/api";
import { AiResponseFormatter } from "../ai-response-formatter";
import { VoiceMicButton } from "@/components/common/voice-mic-button";

const QUESTIONS = [
  "Which customers have not ordered recently?",
  "What is pending against my follow-ups?",
  "Which products did I sell most this month?",
  "How much is outstanding on my customers?",
];

const Spark = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.4 9.3 5 12.9 6.3 9.3 7.6 8 11.2 6.7 7.6 3.1 6.3 6.7 5Z" />
    <path d="M12.7 9.6 13.3 11.3 15 11.9 13.3 12.5 12.7 14.2 12.1 12.5 10.4 11.9 12.1 11.3Z" opacity=".6" />
  </svg>
);

/** Ask AI for salespeople: a header button that opens the same modal shape as the admin console. */
export function SalesAskAi() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  async function runQuery(qToUse?: string) {
    const q = (qToUse ?? question).trim();
    if (!q) return;
    setLoading(true);
    setError("");
    try { setAnswer((await salesFeaturesApi.askAi(q)).answer); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to answer that right now"); }
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
    <>
      <button type="button" className="ask-ai-launch" onClick={() => setOpen(true)}>
        <Spark />
        <span>Ask AI</span>
        <em>AI</em>
      </button>

      {open && (
        <div className="askai-overlay" role="dialog" aria-modal="true" aria-label="Ask AI">
          <button type="button" className="askai-scrim" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="askai-modal">
            <header className="askai-head">
              <span className="askai-title"><Spark />Ask AI</span>
              <span className="askai-badge">Live data</span>
              <button type="button" className="askai-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>

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
                    placeholder="Ask about your customers, visits or follow-ups…"
                    aria-label="Your question"
                  />
                  <VoiceMicButton onTranscript={(text) => setQuestion(text)} />
                  <button type="submit" className="askai-submit-btn" disabled={loading || !question.trim()}>
                    <Spark />
                    <span>{loading ? "Searching…" : "Search"}</span>
                  </button>
                </div>
              </form>

              <p className="askai-label">Suggested questions</p>
              <div className="askai-chips">
                {QUESTIONS.map((item) => (
                  <button type="button" key={item} onClick={() => handleChipClick(item)}>{item}</button>
                ))}
              </div>

              {error && <p className="askai-error" role="alert">{error}</p>}

              {loading && (
                <div className="askai-loading">
                  <div className="askai-spinner"></div>
                  <span>Fetching live intelligence from database...</span>
                </div>
              )}

              {answer && !loading ? (
                <div className="askai-answer-box">
                  <AiResponseFormatter text={answer} source="PSSPL Sales DB" />
                </div>
              ) : (
                !loading && !error && <p className="askai-how"><b>How it works:</b> answers come only from your live customer database and CRM activity.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
