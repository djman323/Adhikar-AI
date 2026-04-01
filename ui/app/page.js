"use client";

import { useEffect, useRef, useState } from "react";

const QUICK_PROMPTS = [
  "What does Article 14 provide?",
  "Explain Article 21 in simple words.",
  "What remedies are available under Article 32?",
  "Difference between Article 19 and Article 21.",
];

export default function Page() {
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [responseStyle, setResponseStyle] = useState("friendly_concise");
  const [status, setStatus] = useState("Ready");
  const [isClarifying, setIsClarifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID().slice(0, 8));
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatRef.current) {
      setTimeout(() => {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 0);
    }
  }, [messages, isSending]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + "px";
    }
  }, [query]);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isSending) return;

    setQuery("");
    setMessages((prev) => [...prev, { role: "You", text: trimmed, variant: "user", sources: [] }]);
    setIsSending(true);
    setStatus("Working...");

    try {
      const response = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          session_id: sessionId,
          response_style: responseStyle,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Request failed");
      }

      const needsClarification = payload.needs_clarification === true;
      setIsClarifying(needsClarification);
      setStatus(needsClarification ? "Clarification mode" : "Answer ready");

      setMessages((prev) => [
        ...prev,
        {
          role: needsClarification ? "Need More Details" : "Adhikar AI",
          text: payload.response || "",
          variant: needsClarification ? "clarification" : "assistant",
          sources: payload.sources || [],
        },
      ]);
    } catch (error) {
      setStatus("Connection issue");
      setIsClarifying(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "System",
          text: `Error: ${error.message}`,
          variant: "system",
          sources: [],
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const statusClass =
    status === "Working..." ? "status-badge--working" : isClarifying ? "status-badge--clarify" : "status-badge--ready";

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="header-title">Adhikar AI - Constitution Chat</h1>
          <p className="header-subtitle">Expert Constitutional lawyer and legal advisor for Indian law</p>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="chat-container" ref={chatRef}>
        <div className="messages-wrapper">
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "40px 20px" }}>
              <p style={{ fontSize: "14px", marginBottom: "16px" }}>Welcome to Adhikar AI</p>
              <p style={{ fontSize: "12px" }}>Ask about Constitutional topics or describe a legal issue you face</p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={`${m.role}-${idx}`} className={`message message--${m.variant}`}>
                <div className="message-bubble">
                  <div className="message-label">{m.role}</div>
                  <p className="message-content">{m.text}</p>

                  {m.sources?.length > 0 && (
                    <details className="sources-wrap">
                      <summary>📎 Sources ({m.sources.length})</summary>
                      <ul className="sources-list">
                        {m.sources.map((src) => (
                          <li key={`${idx}-${src.source_id}`}>
                            [Source {src.source_id}] {src.section_hint} (page {src.page})
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ))
          )}

          {isSending && (
            <div className="message message--assistant">
              <div className="message-bubble">
                <div className="message-label">Adhikar AI</div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="composer-section">
        <div className="composer-inner">
          {/* Controls */}
          <div className="controls-row">
            <div className="status-info">
              <div className={`status-badge ${statusClass}`}>{status}</div>
              <span className="session-id">ID: {sessionId}</span>
            </div>
            <select className="tone-selector" value={responseStyle} onChange={(e) => setResponseStyle(e.target.value)}>
              <option value="friendly_concise">Friendly & Concise</option>
              <option value="student_friendly">Student Friendly</option>
              <option value="short_formal">Formal & Brief</option>
            </select>
          </div>

          {/* Quick Prompts */}
          <div className="quick-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="quick-prompt-btn"
                onClick={() => setQuery(prompt)}
                disabled={isSending}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form className="composer-form" onSubmit={submit}>
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(e);
                  }
                }}
                placeholder="Ask about the Constitution or describe a legal issue..."
                rows={1}
                disabled={isSending}
              />
            </div>
            <button type="submit" className="send-button" disabled={!query.trim() || isSending}>
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
