"use client";
import React, { useState } from "react";
import type { AiAnswerPresentation } from "@/types/ai-answer";

interface AiResponseFormatterProps {
  text: string;
  source?: string;
  from?: string;
  to?: string;
  presentation?: AiAnswerPresentation;
}

/**
 * Parses and formats raw AI text into executive-level visual insight cards,
 * metric pill tags, and structured recommendation blocks.
 */
export function AiResponseFormatter({ text, source, from, to, presentation }: AiResponseFormatterProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!text) return null;

  // Split text into numbered points (e.g. "1. ", "2. ") if structured suggestions exist
  const numberedSections = parseNumberedPoints(text);

  return (
    <div className="askai-answer-wrapper">
      <div className="askai-answer-header">
        <div className="askai-answer-header-title">
          <span className="askai-sparkle-dot"></span>
          <span className="askai-header-tag">AI answer</span>
        </div>
        <button
          type="button"
          className="askai-copy-btn"
          onClick={handleCopy}
          title="Copy AI analysis to clipboard"
        >
          {copied ? (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <path d="M3 8.5L6.5 12L13 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                <rect x="5" y="5" width="8" height="8" rx="1.5" />
                <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" strokeLinecap="round" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="askai-answer-content">
        {presentation ? <div className="askai-simple-answer">
          <p className="askai-simple-period">{presentation.period}</p>
          <h3>{presentation.title}</h3>
          <p className="askai-simple-summary">{presentation.summary}</p>
          {presentation.metrics.length > 0 && <div className="askai-simple-metrics">
            {presentation.metrics.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
          </div>}
          <div className="askai-simple-sections">
            {presentation.sections.map((section, index) => <section key={`${section.title}-${index}`}>
              <h4>{section.title}</h4>
              <ul>{section.points.map((point, i) => <li key={i}>{point}</li>)}</ul>
            </section>)}
          </div>
          {presentation.missing.length > 0 && <details className="askai-simple-missing"><summary>RMs with missing numbers ({presentation.missing.length})</summary><p>{presentation.missing.join(", ")}</p></details>}
          <div className="askai-simple-note"><strong>{presentation.update}</strong><p>{presentation.note}</p></div>
        </div> : numberedSections.length > 0 ? (
          <div className="askai-cards-grid">
            {numberedSections.map((sec, idx) => (
              <div key={idx} className="askai-insight-card">
                <div className="askai-card-num">{String(idx + 1).padStart(2, "0")}</div>
                <div className="askai-card-body">
                  {sec.title && <h4 className="askai-card-title">{cleanText(sec.title)}</h4>}
                  
                  {sec.dataPoint && (
                    <div className="askai-card-dp">
                      <span className="askai-dp-label">Data Point</span>
                      <p>{renderFormattedLine(sec.dataPoint)}</p>
                    </div>
                  )}

                  {sec.action && (
                    <div className="askai-card-act">
                      <span className="askai-act-label">Recommended Action</span>
                      <p>{renderFormattedLine(sec.action)}</p>
                    </div>
                  )}

                  {!sec.dataPoint && !sec.action && sec.rawBody && (
                    <div className="askai-card-raw">
                      <p>{renderFormattedLine(sec.rawBody)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="askai-prose">
            {renderFormattedParagraphs(text)}
          </div>
        )}
      </div>

      <footer className="askai-answer-footer">
        <span className="askai-db-badge">
          <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z"/>
          </svg>
          Tally and CRM records
        </span>
        {!presentation && from && to && (
          <span className="askai-date-range">
            Period: {from} to {to}
          </span>
        )}
      </footer>
    </div>
  );
}

interface NumberedSection {
  title?: string;
  dataPoint?: string;
  action?: string;
  rawBody?: string;
}

/**
 * Attempts to extract structured numbered points (1. Title: ... Data Point: ... Action: ...)
 */
function parseNumberedPoints(raw: string): NumberedSection[] {
  // Clean messy artifacts like "* * **Data Point:**" -> "**Data Point:**"
  const cleaned = raw.replace(/\*\s*\*\s*\*\*/g, "**").replace(/\*\s*\*/g, "");
  
  // Look for numbered patterns like "1. ", "2. ", "1) "
  const splitRegex = /(?:^|\n)(?:\d+\.|\d+\))\s+/g;
  const parts = cleaned.split(splitRegex).map(p => p.trim()).filter(Boolean);

  if (parts.length <= 1 && !/^\s*1\./.test(cleaned)) {
    return [];
  }

  const sections: NumberedSection[] = [];

  for (const part of parts) {
    // If first part was text before '1.', check if it's main text
    if (sections.length === 0 && !part.includes(":") && !part.includes("**")) {
      continue;
    }

    let title = "";
    let dataPoint = "";
    let action = "";
    let rawBody = part;

    // Check if title is bold header at start: **Title:**
    const titleMatch = part.match(/^\*\*([^*]+)\*\*:?/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract Data Point
    const dpMatch = part.match(/(?:\*\*Data Point:\*\*|\*Data Point:\*|Data Point:)\s*([^\n]+|\s*.+?)(?=(?:\*\*Action:\*\*|\*Action:\*|Action:|$))/i);
    if (dpMatch) {
      dataPoint = dpMatch[1].trim();
    }

    // Extract Action
    const actMatch = part.match(/(?:\*\*Action:\*\*|\*Action:\*|Action:)\s*([^\n]+|\s*.+?)$/i);
    if (actMatch) {
      action = actMatch[1].trim();
    }

    // If we extracted title or DP or Action, format cleanly
    if (title || dataPoint || action) {
      // Clean up body text if it had title inside
      if (!title && titleMatch) title = titleMatch[1];

      sections.push({ title, dataPoint, action, rawBody });
    } else {
      // Fallback section with raw body
      sections.push({ rawBody: part });
    }
  }

  return sections;
}

function cleanText(str: string): string {
  return str.replace(/\*\*/g, "").replace(/`|'/g, "").trim();
}

/**
 * Highlights metrics, numbers, currency values (₹), bold text in inline content.
 */
function renderFormattedLine(line: string) {
  // Strip messy asterisk artifacts
  const cleanLine = line
    .replace(/\*\s*\*/g, "")
    .replace(/`([^`]+)`/g, "$1") // remove backticks around code
    .replace(/'\s*\[\]\s*'/g, "Empty"); // convert '[]' to Empty

  const tokens = cleanLine.split(/(\*\*[^*]+\*\*|₹[\d,.]+(?:L|Cr|K)?|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b)/g);

  return (
    <>
      {tokens.map((token, i) => {
        if (!token) return null;
        if (token.startsWith("**") && token.endsWith("**")) {
          return <strong key={i} className="askai-bold-text">{token.slice(2, -2)}</strong>;
        }
        if (/^₹[\d,.]+(?:L|Cr|K)?$/.test(token)) {
          return <span key={i} className="askai-metric-pill currency">{token}</span>;
        }
        if (/^\d{1,3}(?:,\d{3})+$/.test(token) || (parseInt(token, 10) > 99 && !isNaN(Number(token)))) {
          return <span key={i} className="askai-metric-pill num">{token}</span>;
        }
        return token;
      })}
    </>
  );
}

/**
 * Fallback formatter for prose text
 */
function renderFormattedParagraphs(text: string) {
  const cleaned = text
    .replace(/\*\s*\*\s*\*\*/g, "**")
    .replace(/\*\s*\*/g, "")
    .replace(/'\s*\[\]\s*'/g, "Empty");

  const lines = cleaned.split("\n").filter(l => l.trim() !== "");

  return lines.map((line, idx) => {
    if (line.startsWith("###") || line.startsWith("##")) {
      return <h4 key={idx} className="askai-heading">{line.replace(/#+\s*/, "")}</h4>;
    }
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      return (
        <li key={idx} className="askai-list-item">
          {renderFormattedLine(line.trim().slice(2))}
        </li>
      );
    }
    return (
      <p key={idx} className="askai-paragraph">
        {renderFormattedLine(line)}
      </p>
    );
  });
}
